-- Catalog name uniqueness (hardening for the server-side checks in
-- manage-services.ts). Case-insensitive, among ACTIVE rows only (archived rows
-- may legitimately repeat a name that's since been reused).
--
-- APPLY ONLY AFTER confirming no active duplicates exist — creating a unique
-- index errors if duplicates are present. Find any first, e.g.:
--   select lower(name_en), count(*) from public.services
--     where archived_at is null group by 1 having count(*) > 1;
-- (repeat for name_dk, and for public.addons). The app enforces uniqueness
-- server-side regardless; these indexes are a race-proof backstop.

create unique index if not exists services_name_en_unique
  on public.services (lower(name_en)) where archived_at is null;
create unique index if not exists services_name_dk_unique
  on public.services (lower(name_dk)) where archived_at is null;

create unique index if not exists addons_name_en_unique
  on public.addons (lower(name_en)) where archived_at is null;
create unique index if not exists addons_name_dk_unique
  on public.addons (lower(name_dk)) where archived_at is null;
