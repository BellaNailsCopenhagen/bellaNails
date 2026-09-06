-- Retire the `testimonial` asset surface.
--
-- Nothing ever rendered it: `isPublicSurface` excluded it and no query listed
-- assets on it, so a placement there made a photo read as "Live" in the hub
-- while appearing nowhere on the site. Testimonials are words the client wrote,
-- not pictures — the feature that shipped is text-only.
--
-- NOT YET APPLIED. The live project holds no such rows (checked 2026-09-06:
-- one `asset_usages` row, surface `clients_gallery`), so this is a guard against
-- an environment that does, plus the constraint change that stops new ones.

-- 1. Drop any placement on the retired surface. The copies they held are left
--    alone deliberately: a website copy may still be a service-section image or
--    a gallery item, and only the app knows how to check all three.
delete from public.asset_usages where surface = 'testimonial';

-- 2. Stop new ones. Recreate the check without it.
alter table public.asset_usages
  drop constraint if exists asset_usages_surface_check;

alter table public.asset_usages
  add constraint asset_usages_surface_check
  check (surface in ('clients_gallery', 'showcase', 'some'));
