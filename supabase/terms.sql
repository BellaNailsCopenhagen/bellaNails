-- Terms & acceptance tracking.
-- Two versioned, bilingual terms documents:
--   * service — booking / service terms (accepted when a client books)
--   * data    — data-use / media-consent terms (accepted per media consent)
-- Each kind has exactly one "current" version. Every client acceptance records
-- the exact version + context, so we can show — per user — precisely when they
-- accepted the service terms and the data-use terms (down to each photo).
-- APPLY via the Supabase SQL editor / MCP, then regenerate types.ts.

create table if not exists public.terms (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('service', 'data')),
  version    integer not null,
  title_en   text,
  title_dk   text,
  body_en    text,
  body_dk    text,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (kind, version)
);

GRANT SELECT ON TABLE public.terms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.terms TO authenticated;
GRANT ALL ON TABLE public.terms TO service_role;

-- Exactly one current version per kind (partial unique index).
create unique index if not exists terms_one_current_per_kind
  on public.terms (kind) where is_current;

create table if not exists public.terms_acceptances (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  terms_id      uuid references public.terms(id),
  kind          text not null check (kind in ('service', 'data')),
  version       integer not null,
  context       text,                        -- 'booking' | 'media_consent'
  reference_id  text not null default '',    -- booking id / client_media id ('' = general)
  accepted_at   timestamptz not null default now(),
  -- One acceptance per (user, kind, reference); re-accepting is idempotent.
  unique (clerk_user_id, kind, reference_id)
);
create index if not exists terms_acceptances_clerk_user_id_idx
  on public.terms_acceptances (clerk_user_id);

-- RLS: terms are world-readable (public pages render the current version);
-- acceptances are readable by their owner and by the studio owner. All writes
-- go through the service-role client (admin actions + booking/consent flows).
alter table public.terms enable row level security;
create policy "Public reads terms"
  on public.terms for select to anon, authenticated using (true);

alter table public.terms_acceptances enable row level security;
create policy "Owner reads all terms_acceptances"
  on public.terms_acceptances for select to authenticated
  using ((select auth.jwt() -> 'metadata' ->> 'role') = 'owner');
create policy "Clients read own terms_acceptances"
  on public.terms_acceptances for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- Starter content so the pages render and acceptance has a version to pin to on
-- day one. These are editable drafts — the owner replaces them in /admin/terms.
insert into public.terms (kind, version, title_en, title_dk, body_en, body_dk, is_current)
values
  (
    'service', 1,
    'Booking Terms', 'Betingelser for booking',
    E'These booking terms are a starting draft — please replace them in the admin before launch.\n\nAppointments are reserved just for you. If you need to change or cancel, let us know as early as you can so the time can go to someone else.\n\nPlease arrive on time; arriving late may shorten your treatment so the day stays on schedule for everyone.',
    E'Disse betingelser er et udkast — erstat dem i administrationen inden lancering.\n\nDin tid er reserveret til dig. Hvis du har brug for at ændre eller aflyse, så giv os besked så tidligt som muligt, så tiden kan gå til en anden.\n\nMød venligst til tiden; ankomst for sent kan forkorte din behandling, så dagen holder tidsplanen for alle.',
    true
  ),
  (
    'data', 1,
    'Privacy & Data Use', 'Privatliv & databrug',
    E'This privacy notice is a starting draft — please replace it in the admin before launch.\n\nWe collect only what we need to run your appointments: your name, contact details, and booking history.\n\nPhotos of your set are private by default. We ask for your explicit consent before showing any photo on our website or social media, and you can withdraw that consent at any time from your gallery.',
    E'Denne privatlivsmeddelelse er et udkast — erstat den i administrationen inden lancering.\n\nVi indsamler kun det, vi har brug for til dine aftaler: dit navn, kontaktoplysninger og bookinghistorik.\n\nBilleder af dine negle er private som udgangspunkt. Vi beder om dit udtrykkelige samtykke, før vi viser et billede på vores hjemmeside eller sociale medier, og du kan til enhver tid trække samtykket tilbage fra dit galleri.',
    true
  )
on conflict (kind, version) do nothing;

GRANT SELECT ON TABLE public.terms_acceptances TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.terms_acceptances TO authenticated;
GRANT ALL ON TABLE public.terms_acceptances TO service_role;
