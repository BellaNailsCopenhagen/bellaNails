-- Testimonials — client-submitted words the studio chooses to show.
--
-- Separate from `reviews` on purpose: a review is per-SERVICE, studio-entered,
-- text + stars (decided 1 Sep 2026 — no images, richer ones go to Google Maps).
-- A testimonial is STUDIO-level social proof, written by the client in their own
-- words and published only when the studio says so.
--
-- Two independent axes, which is what "choose which are visible" needs:
--   status   requested → submitted (the client wrote it) · declined (we closed it)
--   visible  THE STUDIO'S switch. Meaningless until submitted; never set by the client.
--
-- Replaces three invented quotes that were hardcoded in the message catalogs.
-- Fabricated testimonials are on the EU/Danish prohibited-practices list, so the
-- table starts empty and the section simply doesn't render.

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- What prompted the ask, when there was one.
  booking_id uuid references public.bookings(id) on delete set null,
  -- declined = OUR curation. withdrawn = THEIR right (Art. 7(3)) — different
  -- words on purpose, and a withdrawal overrides the switch.
  status text not null default 'requested'
    check (status in ('requested', 'submitted', 'declined', 'withdrawn')),
  -- The studio's switch. A submitted testimonial is private until it is flipped.
  visible boolean not null default false,
  -- Client-entered. Null until they submit, and nulled again if they ask us to
  -- erase their words (the row survives as the consent record — see below).
  author_name text,
  occupation text,
  body text,
  -- The wording they agreed to, kept for accountability (Art. 7(1)). Consent is
  -- REQUIRED to submit, so this is set whenever `submitted_at` is.
  consent_version text,
  -- Optional manual ordering on the home section; nulls sort last.
  sort_order integer,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  -- They retracted permission to publish.
  withdrawn_at timestamptz,
  -- They went further and asked us to erase the words themselves. The row stays
  -- as a minimal audit shell (dates + consent_version + status) so we can still
  -- show that the publication we DID make was consented to; the personal content
  -- is gone.
  content_erased_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.testimonials TO authenticated;
GRANT ALL ON TABLE public.testimonials TO service_role;

-- The home section's read: visible + submitted, best order first.
create index if not exists testimonials_visible_idx
  on public.testimonials (sort_order nulls last, submitted_at desc)
  where visible = true and status = 'submitted';
-- The review queue.
create index if not exists testimonials_submitted_idx
  on public.testimonials (submitted_at desc) where status = 'submitted';
create index if not exists testimonials_client_idx on public.testimonials (client_id);

-- One OPEN ask per client, so re-asking can't pile up requests on one person.
create unique index if not exists testimonials_one_open_request_per_client
  on public.testimonials (client_id) where status = 'requested';

alter table public.testimonials enable row level security;

-- ANON reads only what is published. The home page is public, so unpublished
-- text has to be unreachable — not merely unrendered.
drop policy if exists "Public reads visible testimonials" on public.testimonials;
create policy "Public reads visible testimonials" on public.testimonials
  for select to anon, authenticated
  using (visible = true and status = 'submitted');

drop policy if exists "Owner reads all testimonials" on public.testimonials;
create policy "Owner reads all testimonials" on public.testimonials
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

drop policy if exists "Clients read own testimonials" on public.testimonials;
create policy "Clients read own testimonials" on public.testimonials
  for select to authenticated using (client_id = public.current_client_id());

-- ANON sees only the four columns the home section renders. RLS already hides
-- unpublished rows; this also keeps `client_id`, `booking_id` and
-- `consent_version` off a public PostgREST response, where `select=*` would
-- otherwise have returned them. Keep in step with `listVisibleTestimonials`.
revoke select on public.testimonials from anon;
grant select (id, author_name, occupation, body, sort_order, submitted_at)
  on public.testimonials to anon;

-- Writes go through service-role server actions that re-verify who is asking:
-- the client may only fill in their OWN requested row, and only the owner may
-- flip `visible`.

-- `communications.kind` is widened in supabase/communications-kinds.sql — the
-- single authority, so re-running this file can't narrow the set again.
