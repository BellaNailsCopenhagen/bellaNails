-- Per-client communication locale — the language a client's transactional
-- emails use (defaults to Danish). APPLY via the Supabase SQL editor / MCP,
-- then regenerate types.ts.
alter table public.clients
  add column communication_locale text not null default 'da'
  check (communication_locale in ('da','en'));
