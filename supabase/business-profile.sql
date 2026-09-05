-- The business's own details: where to find it online, and which addresses
-- its mail comes from. Nothing here is nail-salon specific, hence the name.
--
-- These were build-time constants, which meant a new Instagram handle or a
-- changed mailbox was a code change and a deploy. The constants in
-- src/config/studio.ts stay as the FALLBACK, so nothing breaks before this row
-- exists — an unset field simply means "use the default".
-- APPLY via the Supabase SQL editor, then regenerate src/platform/supabase/types.ts.

create table if not exists public.business_profile (
  -- Single row, same boolean-PK trick as booking_settings.
  id boolean primary key default true check (id),

  -- Public contact. Also the reply-to on every outbound email.
  contact_email text,
  -- Send-as alias for transactional booking mail. Must be an address the SMTP
  -- account is allowed to send as, or the provider will reject it — hence a
  -- field she fills in knowingly rather than anything derived.
  booking_from_email text,
  -- Where the app writes TO her: a client wrote back, a booking request needs
  -- reviewing. A `To:` is never validated by a mail provider, so this is the
  -- one address that can be personal without any deliverability constraint.
  -- Empty falls back to contact_email, which is where these went before.
  alert_email text,

  -- Where it physically is. Two lines because that is how an address is READ
  -- (street, then post town) — one free-text blob renders wrong everywhere.
  -- The map link is derived from these rather than stored: a third field to
  -- keep in sync with the first two is a third field to get wrong.
  address_line_1 text,
  address_line_2 text,
  -- A picture of where that address is: a key in the PUBLIC media bucket,
  -- uploaded through the admin. Deliberately not a live map — that means a
  -- third-party request from every visitor's browser. Empty falls back to a
  -- generic illustration shipped with the app.
  map_image_key text,

  -- Social. Null or empty = the link is not shown at all, which is the honest
  -- state before she has an account rather than a dead link to instagram.com.
  instagram_url text,
  facebook_url text,
  tiktok_url text,

  updated_at timestamptz not null default now()
);

insert into public.business_profile (id) values (true) on conflict (id) do nothing;

-- Read by the public site (footer, Find us) and by the email senders; written
-- only by the owner through a service-role action.
alter table public.business_profile enable row level security;
drop policy if exists "Anyone reads studio profile" on public.business_profile;
create policy "Anyone reads studio profile" on public.business_profile
  for select to anon, authenticated using (true);
