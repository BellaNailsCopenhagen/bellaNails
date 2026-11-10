-- A durable fixed-window rate limiter.
--
-- `shared/rate-limit.ts` holds its counters in one process, so on a serverless
-- deployment each instance enforces its own copy of the limit — enough to stop
-- one client hammering an endpoint, useless as a guard on a write that must be
-- bounded globally. Booking is that write.
--
-- One row per key, one atomic statement per hit: the insert-or-bump below
-- decides inside Postgres, so two concurrent requests can't both read "4 of 5"
-- and both proceed.
-- APPLY via the Supabase SQL editor, then regenerate src/platform/supabase/types.ts.

create table if not exists public.rate_limits (
  -- "<scope>:<subject>", e.g. "booking:create:<client_id>". Opaque to the DB.
  key        text primary key,
  count      integer not null default 0,
  -- When the current window ends; a hit at or after this starts a fresh one.
  reset_at   timestamptz not null,
  updated_at timestamptz not null default now()
);

GRANT SELECT ON TABLE public.rate_limits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;

-- Nobody reads this table through the API — every caller goes through the
-- function below with the service-role client. No policies, so RLS denies all.
alter table public.rate_limits enable row level security;

-- Record one hit for `p_key`. Returns true when it is allowed.
--
-- security definer so the function owns the write; the search_path is pinned
-- because a definer function inherits the CALLER's path otherwise.
create or replace function public.take_rate_limit_token(
  p_key    text,
  p_limit  integer,
  p_window interval
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, count, reset_at, updated_at)
  values (p_key, 1, now() + p_window, now())
  on conflict (key) do update
    -- An expired window resets rather than accumulating, so a key that goes
    -- quiet for an hour starts clean instead of staying blocked.
    set count      = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at   = case when r.reset_at <= now() then now() + p_window else r.reset_at end,
        updated_at = now()
  returning r.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Revoking PUBLIC removes the default EXECUTE for EVERY role, service_role
-- included — so grant it back explicitly, or the limiter fails open on a
-- permission error and silently guards nothing.
revoke all on function public.take_rate_limit_token(text, integer, interval) from public, anon, authenticated;
grant execute on function public.take_rate_limit_token(text, integer, interval) to service_role;

-- Housekeeping: drop keys whose window closed long ago. Called from the app's
-- existing housekeeping pass — the table is tiny, so this is hygiene, not need.
create or replace function public.purge_expired_rate_limits(p_older_than interval default interval '1 day')
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with gone as (
    delete from public.rate_limits where reset_at < now() - p_older_than returning 1
  )
  select coalesce(count(*), 0)::integer from gone;
$$;

revoke all on function public.purge_expired_rate_limits(interval) from public, anon, authenticated;
grant execute on function public.purge_expired_rate_limits(interval) to service_role;
