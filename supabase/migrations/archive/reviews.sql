-- Client reviews per service — the words in the "What clients say" section of a
-- service's detail page. Studio-entered (the owner adds them in admin), so no
-- client-facing write path; consented client PHOTOS come from the media system.
-- APPLY via the Supabase SQL editor / MCP, then confirm types.ts.

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.services(id) on delete cascade,
  author_name text,
  body        text not null,
  rating      integer check (rating between 1 and 5),
  created_at  timestamptz not null default now()
);
create index if not exists reviews_service_idx
  on public.reviews (service_id, created_at desc);

-- Public reads (rendered on the service page); writes are service-role.
alter table public.reviews enable row level security;
create policy "Public reads reviews"
  on public.reviews for select to anon, authenticated using (true);

GRANT SELECT ON TABLE public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;
