-- Storage migration: Cloudinary → Scaleway Object Storage.
-- Additive + nullable so nothing breaks mid-cutover; `cloudinary_public_id` is
-- kept (nullable) and simply stops being written. See
-- docs/tasks/storage-scaleway-migration.md.

-- Published public copies.
alter table assets
  add column if not exists storage_key text,
  add column if not exists storage_provider text not null default 'scaleway';

-- Private originals + client/owner uploads.
alter table client_media
  add column if not exists storage_key text,
  add column if not exists storage_provider text not null default 'scaleway',
  -- image | video — the owner "demo video" exception (decision 9).
  add column if not exists kind text not null default 'image';

-- New rows carry storage_key, not a Cloudinary id.
alter table client_media
  alter column cloudinary_public_id drop not null;
