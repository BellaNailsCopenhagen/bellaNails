-- Media storage: Scaleway Object Storage → Supabase Storage.
--
-- Three buckets, because each carries a DIFFERENT server-enforced limit and
-- Supabase enforces size/MIME per bucket (a signed upload URL cannot carry a
-- policy the way an S3 presigned POST could):
--
--   media-private  the artist's originals + client-work photos   images+video, 200 MB
--   media-refs     a client's design reference photos            images only,    5 MB
--   media-public   published copies, world-readable              images+video, 200 MB
--
-- NO RLS POLICIES ON storage.objects, deliberately. Every path is
-- server-mediated: uploads go through a one-shot signed upload URL minted by the
-- service role, private reads through a short-lived signed GET, and
-- publish/delete run with the service role. So the private buckets are reachable
-- ONLY via those signed grants — anon and authenticated have no direct access at
-- all, which is stricter than a policy set would be. The public bucket needs no
-- policy either (public buckets are readable by design).
--
-- Idempotent: re-running only updates the limits.

-- 200 MB — room for the owner's short demo clip (media-policy.ts OWNER_MAX_BYTES).
-- 5 MB   — a downscaled client image is far under this (CLIENT_MAX_BYTES).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-private', 'media-private', false, 209715200,
   array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
  ('media-refs',    'media-refs',    false,   5242880,
   array['image/jpeg','image/png','image/webp']),
  ('media-public',  'media-public',  true,  209715200,
   array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- New rows are Supabase-hosted. The column is provenance only — no code reads
-- it — but leaving the old default would mislabel every new upload.
alter table public.client_media alter column storage_provider set default 'supabase';
alter table public.assets       alter column storage_provider set default 'supabase';
