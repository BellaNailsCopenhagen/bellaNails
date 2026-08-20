# Auth swap — Clerk → Supabase Auth (implementation plan)

Concrete, file-by-file plan for retiring Clerk in favour of **Supabase Auth**
(Google OAuth + passwordless email OTP). Grounded in a full map of the current
wiring (see the two inventories that produced this). Companion to `DECISION.md`
(the *why* + overall Phase 11 sequence). **Nothing here is built yet.**

## What the code map told us (the shape of the problem)

- **No Supabase session exists today.** Clerk mints the JWT; Supabase trusts it
  via an `accessToken` callback (native third-party auth). The *entire* token
  bridge is two shims — `supabase/server.ts:46-49` and `supabase/client.ts:33` —
  plus one Realtime `setAuth` in `queue-realtime.tsx`. That's the whole surface
  for "issue a session".
- **RLS is load-bearing for READS ONLY.** Every write goes through the
  service-role client (bypasses RLS). The one identity-gated write policy
  (`booking_requests` INSERT) is dormant — no code path uses it. So the migration
  only has to preserve two JWT facts for reads: **who the user is** (`sub`) and
  **is-owner** (`metadata.role`).
- **Guests already have real accounts.** `ensureClerkUser` (Cal webhook →
  `booking-sync.ts:136`) create-or-finds a Clerk user by email even for guests.
  There is **no Clerk webhook** to replace. Backfill pulls from Clerk once.
- **Identity id** = Clerk user id, stored as `clerk_user_id text` on **7 tables**,
  mirrored in RLS as `auth.jwt()->>'sub'`. Two unique constraints bake it into
  identity keys: `client_consents(clerk_user_id,purpose)`,
  `terms_acceptances(clerk_user_id,kind,reference_id)`.

## Target architecture

### Identity model — a `clients` table
```sql
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,          -- lowercased; the join key
  name          text,
  phone         text,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```
- `auth_user_id` is **null until the client logs in** — a guest booker gets a
  `clients` row (and history) with no login, exactly like today.
- **Guest history links by email on login**, via a trigger on `auth.users`:
```sql
create function public.link_client_on_auth_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.clients (email, auth_user_id)
  values (lower(new.email), new.id)
  on conflict (email) do update set auth_user_id = excluded.auth_user_id,
                                    updated_at = now();
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_client_on_auth_user();
```
  A brand-new login creates a `clients` row; a returning guest's existing row is
  linked. Email is the join key (same limitation as today: booking + login must
  share an email to auto-link).

### RLS rewrite (reads only)
Add one helper, then swap the two idioms.
```sql
-- the current user's client id (null when signed out / not yet a client)
create function public.current_client_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from public.clients where auth_user_id = auth.uid()
$$;
```
- **Client-own:** `auth.jwt()->>'sub' = clerk_user_id`
  → `client_id = public.current_client_id()`
- **Owner:** `auth.jwt()->'metadata'->>'role' = 'owner'`
  → `auth.jwt()->'app_metadata'->>'role' = 'owner'`
  (`app_metadata` is in every Supabase JWT and is not user-editable. Set once:
  `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"owner"}'
  where email = '<owner>';`) — no custom access-token hook needed.

### The `clerk_user_id` → `client_id` column migration (7 tables)
One coordinated migration: add `client_id uuid references clients(id)`, backfill
via a `clerk_user_id → clients.id` map (built from the Clerk user export), swap
the two unique constraints and the indexes, rewrite RLS, then drop
`clerk_user_id`. Tables: `bookings`, `booking_requests`, `client_media`,
`media_consents`, `client_consents`, `terms_acceptances`, `owner_notifications`.

### Client factories (the actual swap — add `@supabase/ssr`)
| Factory | Today | After |
|---|---|---|
| `createSupabaseServerClient` (anon/public) | anon key, no token | **unchanged** — stays cookieless so public pages stay static |
| `createAuthedSupabaseServerClient` | anon key + `accessToken: clerk getToken()` | `@supabase/ssr` `createServerClient` reading the session cookie from `next/headers` (setAll try/caught for RSC; proxy refreshes) |
| `createSupabaseServiceRoleClient` | service-role | **unchanged** |
| `useSupabaseBrowserClient` | anon + `accessToken: clerk session.getToken()` | `@supabase/ssr` `createBrowserClient` (owns its cookie session) |

Call sites (`.from(...).select(...)`) don't change — only *how the client gets
its token* changes. Realtime simplifies: the browser client's own auto-refreshed
session drives `setAuth`, dropping the manual 50s Clerk-token refresh loop.

### Session refresh + gate in the proxy
`src/proxy.ts` loses `clerkMiddleware`; gains a `@supabase/ssr` server client that
refreshes the session cookie each request and reads the **validated** user
(`supabase.auth.getUser()`), then:
- `/admin` → redirect home unless `user.app_metadata.role === 'owner'`
- `/account`, `/appointments` → redirect to `/login` unless signed in
- next-intl locale routing stays.

> **Security note (from the Next 16 proxy docs):** the proxy is an *optimistic*
> gate — a matcher change can silently drop a server action from proxy coverage.
> The authoritative owner check stays in `requireOwner()` called inside **every**
> admin RSC and **every** admin server action (already the pattern today — ~15
> action files). Keep it.

## Auth flows + new files

- **`src/app/auth/callback/route.ts`** (new) — OAuth PKCE callback:
  `exchangeCodeForSession(code)` then redirect to `?next`. Excluded from the
  auth gate.
- **Google:** `supabase.auth.signInWithOAuth({ provider: 'google',
  options: { redirectTo: '<origin>/auth/callback?next=...' } })` (browser).
- **Email OTP:** `signInWithOtp({ email, options: { shouldCreateUser: true } })`
  → user gets a 6-digit code → `verifyOtp({ email, token, type: 'email' })`.
  Requires the Supabase "Magic Link" email template to emit `{{ .Token }}`.
- **Sign out:** `supabase.auth.signOut()`.

### The `src/lib/identity/` facade (build first, over Clerk; swap innards later)
Every component calls these — never Clerk/Supabase directly:
```
getCurrentUser(): AppUser | null          // { id, email, name?, phone?, isOwner }
requireOwner(): ServiceClient | null      // exists today in admin/require-owner.ts
ensureUser({email,name?,phone?}): id      // today ensureClerkUser → later clients upsert
getUserContacts(ids): Record<id,Contact>  // today clerk/client-contacts → later clients read
// client-side:
useCurrentUser()                          // today Clerk useUser → later onAuthStateChange
signInWithGoogle() / signInWithEmailOtp() / verifyEmailOtp() / signOut()
```

## UI to replace (Clerk components have no drop-in Supabase equivalent)
- `<SignIn>` / `<SignUp>` / `<UserProfile>` catch-all pages → a custom `/login`
  (Google button + email→OTP) and a minimal account page.
- Inline `<SignUp>` on `confirmation.tsx` → the same login form, email prefilled.
- `<UserButton>` ×2 (`site-header.tsx`, `admin-shell.tsx`) → small account menu
  (initials + sign out).
- `<Show when="signed-in|out">` ×6 → server `getCurrentUser()` or a client
  `useCurrentUser()`.
- `ClerkProvider` ×2 (`[locale]/layout.tsx`, `admin/layout.tsx`) → a light client
  `SessionProvider` (browser client + `onAuthStateChange`) only where reactivity
  is needed; server reads need no provider.
- `clerk/client-contacts.ts` (Clerk Backend API) → read name/email/phone from
  `clients`; `activated = auth_user_id is not null`. `clerk/contact.ts`
  (client-safe) is unchanged.

## Sequenced execution (maps to DECISION.md)
1. **Add `@supabase/ssr`; build the `identity/` facade over current Clerk** +
   migrate components onto it. Non-breaking, behaviour identical. *(Safe now.)*
2. **Owner setup (Supabase dashboard):** enable Google (needs the OAuth client) +
   email OTP; set custom SMTP → ZeptoMail; edit the OTP email template.
3. **`clients` table + trigger + PII backfill from Clerk.** New table, no RLS
   break yet.
4. **Column migration + RLS rewrite** (`clerk_user_id`→`client_id`, owner claim →
   `app_metadata`, `current_client_id()`), **swap the 4 factories + proxy to
   `@supabase/ssr`, swap facade innards, remove Clerk.** The one breaking window —
   apply with the app in maintenance; test auth + admin gate + a client's own
   reads end-to-end.
5. **Cleanup:** drop `@clerk/*` deps, `CLERK_*` env, the two `ClerkProvider`
   roots, Clerk appearance/localization config.

### Owner-only prerequisites before step 2
- A **Google OAuth client** (Authorized redirect URI =
  `https://<project>.supabase.co/auth/v1/callback`). *(In progress.)*
- In Supabase Auth: enable Google + Email (OTP), point email at ZeptoMail SMTP.

## Risks / gotchas
- **Realtime + custom domain:** the JWKS `.well-known` gotcha noted in
  `docs/INFRASTRUCTURE.md` applies to the Supabase-issued token too — verify
  Realtime authorization after the swap.
- **`getUser()` vs `getSession()`:** always `getUser()` on the server (it
  validates the token); `getSession()` trusts the cookie unverified.
- **Dynamic rendering:** anything reading the session cookie is dynamic — keep
  public/catalog reads on the cookieless anon client so those pages stay static.
- **Email-join limitation:** a client who books under one email and logs in with
  another Google email won't auto-link (same as today). Acceptable.
- **Backfill timing:** export Clerk users while Clerk is still live (step 3);
  keep the map for the column migration (step 4).
