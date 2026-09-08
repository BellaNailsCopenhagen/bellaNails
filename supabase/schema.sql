-- ============================================================================
-- Bella Nails — the whole database, in one file
-- ============================================================================
--
-- Run this ONCE on an empty Supabase project and you have the schema the app
-- expects: 35 tables, their keys, indexes and checks, RLS on every one of them,
-- 45 policies, the helper functions, the signup trigger and the Realtime
-- publication. Then `seed.sql` (+ `addons-seed.sql`) if you want dev data.
--
--   psql "$DATABASE_URL" -f supabase/schema.sql
--
-- It replaces the 50-odd incremental files beside it, which are kept as the
-- history of how the live database got here — several are superseded, one
-- (`outside-hours.sql`) targets a table that no longer exists and must never be
-- run. For a NEW environment this file is the only one you need.
--
-- Not hand-written: every earlier migration was replayed against an empty
-- Postgres 15 in dependency order and the result dumped, so the file cannot
-- disagree with what the migrations actually build. Verified by restoring it
-- into a second empty database and diffing the catalogs — see
-- docs/tasks/DATABASE.md.
--
-- Assumes a Supabase project, i.e. that these already exist: the `anon`,
-- `authenticated` and `service_role` roles, the `auth` schema with
-- `auth.uid()`, and the `supabase_realtime` publication. On bare Postgres you
-- need a shim for those first.
--
-- Localized columns use `_dk` for Danish and `_en` for English — the `da`
-- locale maps to `_dk`.
-- ============================================================================

--
--


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

--
-- Name: current_client_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_client_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id from public.clients where auth_user_id = auth.uid()
$$;


--


-- --------------------------------------------------------------------------
-- FUNCTIONS
-- Helpers the tables and policies below depend on — declared first.
-- --------------------------------------------------------------------------

-- Name: link_client_on_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_client_on_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Google + email-OTP always carry an email; guard anyway (email is NOT NULL).
  if new.email is not null then
    insert into public.clients (email, auth_user_id)
    values (lower(new.email), new.id)
    on conflict (email) do update
      set auth_user_id = excluded.auth_user_id, updated_at = now();
  end if;
  return new;
end $$;


--
-- Name: purge_expired_rate_limits(interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_expired_rate_limits(p_older_than interval DEFAULT '1 day'::interval) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  with gone as (
    delete from public.rate_limits where reset_at < now() - p_older_than returning 1
  )
  select coalesce(count(*), 0)::integer from gone;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: take_rate_limit_token(text, integer, interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.take_rate_limit_token(p_key text, p_limit integer, p_window interval) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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


SET default_tablespace = '';


--


-- --------------------------------------------------------------------------
-- TABLES
-- 35 tables. Order is dependency order: a foreign key's target comes first.
-- --------------------------------------------------------------------------

-- Name: addon_incompatibilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addon_incompatibilities (
    addon_id_a uuid NOT NULL,
    addon_id_b uuid NOT NULL
);


--
-- Name: addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid,
    name_en text NOT NULL,
    name_dk text NOT NULL,
    extra_price_cents integer NOT NULL,
    extra_duration_mins integer NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: asset_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_usages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    surface text NOT NULL,
    url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_usages_surface_check CHECK ((surface = ANY (ARRAY['clients_gallery'::text, 'showcase'::text, 'some'::text])))
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    media_type text NOT NULL,
    storage_key text,
    storage_provider text DEFAULT 'supabase'::text NOT NULL,
    cloudinary_public_id text,
    created_at timestamp with time zone DEFAULT now(),
    client_media_id uuid,
    purpose text,
    needs_takedown_at timestamp with time zone,
    CONSTRAINT assets_purpose_check CHECK ((purpose = ANY (ARRAY['website'::text, 'social'::text])))
);


--
-- Name: blocked_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    value text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blocked_identities_kind_check CHECK ((kind = ANY (ARRAY['email'::text, 'domain'::text, 'ip'::text])))
);


--
-- Name: booking_protection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_protection (
    id boolean DEFAULT true NOT NULL,
    access_level text DEFAULT 'verified'::text NOT NULL,
    human_check boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_protection_access_level_check CHECK ((access_level = ANY (ARRAY['open'::text, 'verified'::text, 'card'::text]))),
    CONSTRAINT booking_protection_id_check CHECK (id)
);


--
-- Name: booking_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    kind text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    selected_addons jsonb DEFAULT '{}'::jsonb NOT NULL,
    total_price_cents integer DEFAULT 0 NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    booking_id uuid,
    reject_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    CONSTRAINT booking_requests_kind_check CHECK ((kind = ANY (ARRAY['outside_hours'::text, 'over_limit'::text]))),
    CONSTRAINT booking_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);


--
-- Name: booking_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_settings (
    id boolean DEFAULT true NOT NULL,
    slot_interval_mins integer DEFAULT 30 NOT NULL,
    buffer_mins integer DEFAULT 15 NOT NULL,
    min_lead_mins integer DEFAULT 1440 NOT NULL,
    max_advance_days integer DEFAULT 60 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_settings_positive CHECK (((slot_interval_mins > 0) AND (buffer_mins >= 0) AND (min_lead_mins >= 0) AND (max_advance_days > 0))),
    CONSTRAINT booking_settings_singleton CHECK (id)
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    status text NOT NULL,
    total_price_cents integer NOT NULL,
    income_override_cents integer,
    selected_addons jsonb,
    client_notes text,
    no_show_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    client_id uuid NOT NULL
);


--
-- Name: COLUMN bookings.client_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.client_notes IS 'The client''s own session note from the booking form (webhook metadata clientNotes). Also embedded in the human notes string Cal shows the artist.';


--
-- Name: business_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_profile (
    id boolean DEFAULT true NOT NULL,
    contact_email text,
    booking_from_email text,
    alert_email text,
    address_line_1 text,
    address_line_2 text,
    map_image_key text,
    instagram_url text,
    facebook_url text,
    tiktok_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hero_asset_key text,
    CONSTRAINT business_profile_id_check CHECK (id)
);


--
-- Name: COLUMN business_profile.alert_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.business_profile.alert_email IS 'Where the app writes TO her. A To: is never validated by a mail provider, so this is the one address that can be personal. Empty falls back to contact_email.';


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_en text NOT NULL,
    name_dk text NOT NULL,
    description_en text,
    description_dk text,
    image_url text,
    sort_order integer,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: client_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purpose text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_at timestamp with time zone,
    declined_at timestamp with time zone,
    withdrawn_at timestamp with time zone,
    client_id uuid NOT NULL,
    CONSTRAINT client_consents_purpose_check CHECK ((purpose = ANY (ARRAY['testimonial_site'::text, 'testimonial_some'::text, 'name_site'::text, 'name_some'::text]))),
    CONSTRAINT client_consents_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'granted'::text, 'declined'::text, 'withdrawn'::text])))
);


--
-- Name: client_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    cloudinary_public_id text,
    url text NOT NULL,
    service_id uuid,
    booking_id uuid,
    is_feature boolean DEFAULT false NOT NULL,
    in_gallery boolean DEFAULT false NOT NULL,
    caption text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    storage_key text,
    storage_provider text DEFAULT 'supabase'::text NOT NULL,
    kind text DEFAULT 'image'::text NOT NULL,
    dismissed_at timestamp with time zone,
    favorited_at timestamp with time zone,
    client_id uuid NOT NULL,
    CONSTRAINT client_media_source_check CHECK ((source = ANY (ARRAY['owner'::text, 'client'::text])))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    phone text,
    auth_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    anonymized_at timestamp with time zone,
    communication_locale text DEFAULT 'da'::text NOT NULL,
    CONSTRAINT clients_communication_locale_check CHECK ((communication_locale = ANY (ARRAY['da'::text, 'en'::text])))
);


--
-- Name: communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    booking_id uuid,
    kind text NOT NULL,
    trigger text NOT NULL,
    channel text DEFAULT 'email'::text NOT NULL,
    recipient text,
    status text NOT NULL,
    error text,
    reminder_for timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT communications_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'in_app'::text, 'push'::text]))),
    CONSTRAINT communications_kind_check CHECK ((kind = ANY (ARRAY['confirmation'::text, 'cancellation'::text, 'reschedule'::text, 'reminder'::text, 'media_release_request'::text, 'review_request'::text, 'booking_request_received'::text, 'booking_request_declined'::text, 'design_request_received'::text, 'design_reply'::text, 'design_offer_sent'::text, 'design_request_declined'::text, 'testimonial_request'::text]))),
    CONSTRAINT communications_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT communications_trigger_check CHECK ((trigger = ANY (ARRAY['auto'::text, 'manual'::text])))
);


--
-- Name: design_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    author text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT design_messages_author_check CHECK ((author = ANY (ARRAY['client'::text, 'artist'::text])))
);


--
-- Name: design_refs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_refs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    message_id uuid,
    client_id uuid NOT NULL,
    storage_key text NOT NULL,
    storage_provider text DEFAULT 'supabase'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    purge_after timestamp with time zone DEFAULT (now() + '90 days'::interval) NOT NULL
);


--
-- Name: design_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    topic text NOT NULL,
    service_id uuid,
    booking_id uuid,
    preferred_window text,
    status text DEFAULT 'open'::text NOT NULL,
    decline_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    answered_at timestamp with time zone,
    closed_at timestamp with time zone,
    client_seen_at timestamp with time zone,
    last_artist_reply_at timestamp with time zone,
    CONSTRAINT design_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'offered'::text, 'booked'::text, 'declined'::text, 'expired'::text]))),
    CONSTRAINT design_requests_topic_check CHECK ((topic = ANY (ARRAY['new_design'::text, 'repair'::text, 'other'::text])))
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gallery_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    primary_asset_id uuid,
    before_asset_id uuid,
    display_mode text NOT NULL,
    title_en text,
    title_dk text,
    sort_order integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gallery_items_sort_order_range CHECK (((sort_order IS NULL) OR ((sort_order >= 1) AND (sort_order <= 5))))
);


--
-- Name: insights_months; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insights_months (
    month_key integer NOT NULL,
    appointments integer DEFAULT 0 NOT NULL,
    adjusted integer DEFAULT 0 NOT NULL,
    income_cents bigint DEFAULT 0 NOT NULL,
    booked_mins integer DEFAULT 0 NOT NULL,
    open_mins integer,
    stale boolean DEFAULT false NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: media_releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_releases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    purpose text NOT NULL,
    status text NOT NULL,
    consent_version text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_at timestamp with time zone,
    declined_at timestamp with time zone,
    withdrawn_at timestamp with time zone,
    CONSTRAINT media_releases_purpose_check CHECK ((purpose = ANY (ARRAY['website'::text, 'social'::text, 'education'::text]))),
    CONSTRAINT media_releases_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'granted'::text, 'declined'::text, 'withdrawn'::text])))
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    booking_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    request_id uuid NOT NULL,
    name_en text NOT NULL,
    name_dk text,
    duration_mins integer NOT NULL,
    price_cents integer NOT NULL,
    artist_note text,
    expires_at timestamp with time zone NOT NULL,
    booking_id uuid,
    withdrawn_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offers_duration_mins_check CHECK ((duration_mins > 0)),
    CONSTRAINT offers_price_cents_check CHECK ((price_cents >= 0))
);


--
-- Name: owner_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    client_media_id uuid,
    purpose text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    client_id uuid NOT NULL,
    target_id uuid
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    price_cents integer NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT price_history_entity_type_check CHECK ((entity_type = ANY (ARRAY['service'::text, 'addon'::text])))
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    author_name text,
    body text NOT NULL,
    rating integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: schedule_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    weekday smallint,
    on_date date,
    start_time text NOT NULL,
    end_time text NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_rules_kind_check CHECK ((kind = ANY (ARRAY['standard'::text, 'outside'::text, 'no_work'::text]))),
    CONSTRAINT schedule_rules_recurrence CHECK (((weekday IS NULL) <> (on_date IS NULL))),
    CONSTRAINT schedule_rules_time_valid CHECK (((start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text) AND (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text) AND (start_time < end_time))),
    CONSTRAINT schedule_rules_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: service_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_addons (
    service_id uuid NOT NULL,
    addon_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    title_en text,
    title_dk text,
    body_en text,
    body_dk text,
    asset_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid,
    name_en text NOT NULL,
    name_dk text NOT NULL,
    description_en text,
    description_dk text,
    base_price_cents integer NOT NULL,
    base_duration_mins integer NOT NULL,
    image_url text,
    is_featured boolean DEFAULT false,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    version integer NOT NULL,
    title_en text,
    title_dk text,
    body_en text,
    body_dk text,
    is_current boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT terms_kind_check CHECK ((kind = ANY (ARRAY['service'::text, 'data'::text])))
);


--
-- Name: terms_acceptances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terms_acceptances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    terms_id uuid,
    kind text NOT NULL,
    version integer NOT NULL,
    context text,
    reference_id text DEFAULT ''::text NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id uuid NOT NULL,
    CONSTRAINT terms_acceptances_kind_check CHECK ((kind = ANY (ARRAY['service'::text, 'data'::text])))
);


--
-- Name: testimonials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.testimonials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    booking_id uuid,
    status text DEFAULT 'requested'::text NOT NULL,
    visible boolean DEFAULT false NOT NULL,
    author_name text,
    occupation text,
    body text,
    consent_version text,
    sort_order integer,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    decided_at timestamp with time zone,
    withdrawn_at timestamp with time zone,
    content_erased_at timestamp with time zone,
    CONSTRAINT testimonials_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'submitted'::text, 'declined'::text, 'withdrawn'::text])))
);


--


-- --------------------------------------------------------------------------
-- KEYS AND CONSTRAINTS
-- Primary keys, uniqueness, checks, and the booking overlap exclusion.
-- --------------------------------------------------------------------------

-- Name: addon_incompatibilities addon_incompatibilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_incompatibilities
    ADD CONSTRAINT addon_incompatibilities_pkey PRIMARY KEY (addon_id_a, addon_id_b);


--
-- Name: addons addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_pkey PRIMARY KEY (id);


--
-- Name: asset_usages asset_usages_asset_id_surface_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usages
    ADD CONSTRAINT asset_usages_asset_id_surface_key UNIQUE (asset_id, surface);


--
-- Name: asset_usages asset_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usages
    ADD CONSTRAINT asset_usages_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: blocked_identities blocked_identities_kind_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_identities
    ADD CONSTRAINT blocked_identities_kind_value_key UNIQUE (kind, value);


--
-- Name: blocked_identities blocked_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_identities
    ADD CONSTRAINT blocked_identities_pkey PRIMARY KEY (id);


--
-- Name: booking_protection booking_protection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_protection
    ADD CONSTRAINT booking_protection_pkey PRIMARY KEY (id);


--
-- Name: booking_requests booking_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);


--
-- Name: booking_settings booking_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_settings
    ADD CONSTRAINT booking_settings_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (tstzrange(start_time, end_time) WITH &&) WHERE ((status = ANY (ARRAY['confirmed'::text, 'rescheduled'::text])));


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: business_profile business_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profile
    ADD CONSTRAINT business_profile_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: client_consents client_consents_client_id_purpose_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_consents
    ADD CONSTRAINT client_consents_client_id_purpose_key UNIQUE (client_id, purpose);


--
-- Name: client_consents client_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_consents
    ADD CONSTRAINT client_consents_pkey PRIMARY KEY (id);


--
-- Name: client_media client_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_media
    ADD CONSTRAINT client_media_pkey PRIMARY KEY (id);


--
-- Name: clients clients_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: clients clients_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_email_key UNIQUE (email);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: communications communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pkey PRIMARY KEY (id);


--
-- Name: design_messages design_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_messages
    ADD CONSTRAINT design_messages_pkey PRIMARY KEY (id);


--
-- Name: design_refs design_refs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_refs
    ADD CONSTRAINT design_refs_pkey PRIMARY KEY (id);


--
-- Name: design_requests design_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_requests
    ADD CONSTRAINT design_requests_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (key);


--
-- Name: gallery_items gallery_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_pkey PRIMARY KEY (id);


--
-- Name: insights_months insights_months_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights_months
    ADD CONSTRAINT insights_months_pkey PRIMARY KEY (month_key);


--
-- Name: media_releases media_releases_booking_id_purpose_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_releases
    ADD CONSTRAINT media_releases_booking_id_purpose_key UNIQUE (booking_id, purpose);


--
-- Name: media_releases media_releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_releases
    ADD CONSTRAINT media_releases_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: owner_notifications owner_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_notifications
    ADD CONSTRAINT owner_notifications_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: schedule_rules schedule_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_rules
    ADD CONSTRAINT schedule_rules_pkey PRIMARY KEY (id);


--
-- Name: service_addons service_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_addons
    ADD CONSTRAINT service_addons_pkey PRIMARY KEY (service_id, addon_id);


--
-- Name: service_sections service_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sections
    ADD CONSTRAINT service_sections_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: terms_acceptances terms_acceptances_client_id_kind_reference_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_acceptances
    ADD CONSTRAINT terms_acceptances_client_id_kind_reference_id_key UNIQUE (client_id, kind, reference_id);


--
-- Name: terms_acceptances terms_acceptances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_acceptances
    ADD CONSTRAINT terms_acceptances_pkey PRIMARY KEY (id);


--
-- Name: terms terms_kind_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms
    ADD CONSTRAINT terms_kind_version_key UNIQUE (kind, version);


--
-- Name: terms terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms
    ADD CONSTRAINT terms_pkey PRIMARY KEY (id);


--
-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);


--


-- --------------------------------------------------------------------------
-- INDEXES
-- Including the partial unique indexes that enforce one-current-version rules.
-- --------------------------------------------------------------------------

-- Name: addons_name_dk_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX addons_name_dk_unique ON public.addons USING btree (lower(name_dk)) WHERE (archived_at IS NULL);


--
-- Name: addons_name_en_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX addons_name_en_unique ON public.addons USING btree (lower(name_en)) WHERE (archived_at IS NULL);


--
-- Name: asset_usages_asset_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_usages_asset_id_idx ON public.asset_usages USING btree (asset_id);


--
-- Name: asset_usages_surface_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_usages_surface_idx ON public.asset_usages USING btree (surface);


--
-- Name: assets_client_media_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_client_media_idx ON public.assets USING btree (client_media_id);


--
-- Name: blocked_identities_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocked_identities_lookup_idx ON public.blocked_identities USING btree (kind, value);


--
-- Name: booking_requests_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_requests_client_idx ON public.booking_requests USING btree (client_id);


--
-- Name: booking_requests_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_requests_pending_idx ON public.booking_requests USING btree (created_at) WHERE (status = 'pending'::text);


--
-- Name: bookings_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_client_id_idx ON public.bookings USING btree (client_id);


--
-- Name: categories_name_dk_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_name_dk_unique ON public.categories USING btree (lower(name_dk)) WHERE (archived_at IS NULL);


--
-- Name: categories_name_en_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_name_en_unique ON public.categories USING btree (lower(name_en)) WHERE (archived_at IS NULL);


--
-- Name: client_consents_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_consents_client_id_idx ON public.client_consents USING btree (client_id);


--
-- Name: client_media_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_media_client_id_idx ON public.client_media USING btree (client_id);


--
-- Name: client_media_one_feature_per_service; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX client_media_one_feature_per_service ON public.client_media USING btree (service_id) WHERE (is_feature AND (archived_at IS NULL) AND (service_id IS NOT NULL));


--
-- Name: client_media_service_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_media_service_id_idx ON public.client_media USING btree (service_id);


--
-- Name: communications_client_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communications_client_created_idx ON public.communications USING btree (client_id, created_at DESC);


--
-- Name: communications_reminder_sent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX communications_reminder_sent_idx ON public.communications USING btree (booking_id, reminder_for) WHERE ((kind = 'reminder'::text) AND (status = 'sent'::text));


--
-- Name: design_messages_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_messages_request_idx ON public.design_messages USING btree (request_id, created_at);


--
-- Name: design_refs_purge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_refs_purge_idx ON public.design_refs USING btree (purge_after);


--
-- Name: design_refs_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_refs_request_idx ON public.design_refs USING btree (request_id);


--
-- Name: design_requests_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_requests_client_idx ON public.design_requests USING btree (client_id, created_at DESC);


--
-- Name: design_requests_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_requests_open_idx ON public.design_requests USING btree (created_at) WHERE (status = ANY (ARRAY['open'::text, 'offered'::text]));


--
-- Name: gallery_items_featured_sort_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gallery_items_featured_sort_order_key ON public.gallery_items USING btree (sort_order) WHERE (sort_order IS NOT NULL);


--
-- Name: media_releases_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_releases_client_idx ON public.media_releases USING btree (client_id);


--
-- Name: media_releases_granted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_releases_granted_idx ON public.media_releases USING btree (booking_id, purpose) WHERE (status = 'granted'::text);


--
-- Name: media_releases_requested_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_releases_requested_idx ON public.media_releases USING btree (client_id) WHERE (status = 'requested'::text);


--
-- Name: notes_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notes_booking_id_idx ON public.notes USING btree (booking_id);


--
-- Name: notes_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notes_client_id_idx ON public.notes USING btree (client_id);


--
-- Name: offers_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offers_client_idx ON public.offers USING btree (client_id, created_at DESC);


--
-- Name: offers_one_live_per_request; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX offers_one_live_per_request ON public.offers USING btree (request_id) WHERE ((closed_at IS NULL) AND (booking_id IS NULL));


--
-- Name: owner_notifications_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX owner_notifications_client_id_idx ON public.owner_notifications USING btree (client_id);


--
-- Name: owner_notifications_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX owner_notifications_unread_idx ON public.owner_notifications USING btree (created_at DESC) WHERE (read_at IS NULL);


--
-- Name: price_history_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX price_history_entity_idx ON public.price_history USING btree (entity_type, entity_id, changed_at DESC);


--
-- Name: reviews_service_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_service_idx ON public.reviews USING btree (service_id, created_at DESC);


--
-- Name: schedule_rules_on_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_rules_on_date_idx ON public.schedule_rules USING btree (on_date);


--
-- Name: schedule_rules_weekday_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_rules_weekday_idx ON public.schedule_rules USING btree (weekday);


--
-- Name: service_addons_addon_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_addons_addon_id_idx ON public.service_addons USING btree (addon_id);


--
-- Name: service_sections_service_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_sections_service_idx ON public.service_sections USING btree (service_id, sort_order);


--
-- Name: services_name_dk_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX services_name_dk_unique ON public.services USING btree (lower(name_dk)) WHERE (archived_at IS NULL);


--
-- Name: services_name_en_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX services_name_en_unique ON public.services USING btree (lower(name_en)) WHERE (archived_at IS NULL);


--
-- Name: terms_acceptances_client_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX terms_acceptances_client_id_idx ON public.terms_acceptances USING btree (client_id);


--
-- Name: terms_one_current_per_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX terms_one_current_per_kind ON public.terms USING btree (kind) WHERE is_current;


--
-- Name: testimonials_client_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX testimonials_client_idx ON public.testimonials USING btree (client_id);


--
-- Name: testimonials_one_open_request_per_client; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX testimonials_one_open_request_per_client ON public.testimonials USING btree (client_id) WHERE (status = 'requested'::text);


--
-- Name: testimonials_submitted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX testimonials_submitted_idx ON public.testimonials USING btree (submitted_at DESC) WHERE (status = 'submitted'::text);


--
-- Name: testimonials_visible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX testimonials_visible_idx ON public.testimonials USING btree (sort_order, submitted_at DESC) WHERE ((visible = true) AND (status = 'submitted'::text));


--


-- --------------------------------------------------------------------------
-- FOREIGN KEYS
-- Applied after every table exists, so the file has no ordering trap.
-- --------------------------------------------------------------------------

-- Name: addon_incompatibilities addon_incompatibilities_addon_id_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_incompatibilities
    ADD CONSTRAINT addon_incompatibilities_addon_id_a_fkey FOREIGN KEY (addon_id_a) REFERENCES public.addons(id) ON DELETE CASCADE;


--
-- Name: addon_incompatibilities addon_incompatibilities_addon_id_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_incompatibilities
    ADD CONSTRAINT addon_incompatibilities_addon_id_b_fkey FOREIGN KEY (addon_id_b) REFERENCES public.addons(id) ON DELETE CASCADE;


--
-- Name: addons addons_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addons
    ADD CONSTRAINT addons_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: asset_usages asset_usages_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usages
    ADD CONSTRAINT asset_usages_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: assets assets_client_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_client_media_id_fkey FOREIGN KEY (client_media_id) REFERENCES public.client_media(id) ON DELETE CASCADE;


--
-- Name: booking_requests booking_requests_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_consents client_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_consents
    ADD CONSTRAINT client_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_media client_media_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_media
    ADD CONSTRAINT client_media_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: client_media client_media_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_media
    ADD CONSTRAINT client_media_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_media client_media_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_media
    ADD CONSTRAINT client_media_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: clients clients_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: communications communications_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: communications communications_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: design_messages design_messages_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_messages
    ADD CONSTRAINT design_messages_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.design_requests(id) ON DELETE CASCADE;


--
-- Name: design_refs design_refs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_refs
    ADD CONSTRAINT design_refs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: design_refs design_refs_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_refs
    ADD CONSTRAINT design_refs_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.design_messages(id) ON DELETE SET NULL;


--
-- Name: design_refs design_refs_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_refs
    ADD CONSTRAINT design_refs_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.design_requests(id) ON DELETE CASCADE;


--
-- Name: design_requests design_requests_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_requests
    ADD CONSTRAINT design_requests_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: design_requests design_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_requests
    ADD CONSTRAINT design_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: design_requests design_requests_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_requests
    ADD CONSTRAINT design_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: gallery_items gallery_items_before_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_before_asset_id_fkey FOREIGN KEY (before_asset_id) REFERENCES public.assets(id);


--
-- Name: gallery_items gallery_items_primary_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_items
    ADD CONSTRAINT gallery_items_primary_asset_id_fkey FOREIGN KEY (primary_asset_id) REFERENCES public.assets(id);


--
-- Name: media_releases media_releases_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_releases
    ADD CONSTRAINT media_releases_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: media_releases media_releases_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_releases
    ADD CONSTRAINT media_releases_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: notes notes_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: notes notes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: offers offers_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: offers offers_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: offers offers_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.design_requests(id) ON DELETE CASCADE;


--
-- Name: owner_notifications owner_notifications_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_notifications
    ADD CONSTRAINT owner_notifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: owner_notifications owner_notifications_client_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_notifications
    ADD CONSTRAINT owner_notifications_client_media_id_fkey FOREIGN KEY (client_media_id) REFERENCES public.client_media(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: service_addons service_addons_addon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_addons
    ADD CONSTRAINT service_addons_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.addons(id) ON DELETE CASCADE;


--
-- Name: service_addons service_addons_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_addons
    ADD CONSTRAINT service_addons_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: service_sections service_sections_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sections
    ADD CONSTRAINT service_sections_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: service_sections service_sections_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_sections
    ADD CONSTRAINT service_sections_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: terms_acceptances terms_acceptances_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_acceptances
    ADD CONSTRAINT terms_acceptances_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: terms_acceptances terms_acceptances_terms_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms_acceptances
    ADD CONSTRAINT terms_acceptances_terms_id_fkey FOREIGN KEY (terms_id) REFERENCES public.terms(id);


--
-- Name: testimonials testimonials_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: testimonials testimonials_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--


-- --------------------------------------------------------------------------
-- POLICIES
-- 45 policies: public reads the active catalog, a client reads their own, the owner reads all.
-- --------------------------------------------------------------------------

-- Name: booking_protection Anyone reads booking protection; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone reads booking protection" ON public.booking_protection FOR SELECT TO anon, authenticated USING (true);


--
-- Name: business_profile Anyone reads studio profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone reads studio profile" ON public.business_profile FOR SELECT TO anon, authenticated USING (true);


--
-- Name: booking_requests Clients read own booking_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own booking_requests" ON public.booking_requests FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: client_consents Clients read own client_consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own client_consents" ON public.client_consents FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: client_media Clients read own client_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own client_media" ON public.client_media FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: design_messages Clients read own design_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own design_messages" ON public.design_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.design_requests r
  WHERE ((r.id = design_messages.request_id) AND (r.client_id = public.current_client_id())))));


--
-- Name: design_refs Clients read own design_refs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own design_refs" ON public.design_refs FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: design_requests Clients read own design_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own design_requests" ON public.design_requests FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: media_releases Clients read own media_releases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own media_releases" ON public.media_releases FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: offers Clients read own offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own offers" ON public.offers FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: clients Clients read own row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own row" ON public.clients FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: terms_acceptances Clients read own terms_acceptances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own terms_acceptances" ON public.terms_acceptances FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: testimonials Clients read own testimonials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients read own testimonials" ON public.testimonials FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--
-- Name: booking_requests Owner reads all booking_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all booking_requests" ON public.booking_requests FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: bookings Owner reads all bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all bookings" ON public.bookings FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: client_consents Owner reads all client_consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all client_consents" ON public.client_consents FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: client_media Owner reads all client_media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all client_media" ON public.client_media FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: clients Owner reads all clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all clients" ON public.clients FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: design_messages Owner reads all design_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all design_messages" ON public.design_messages FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: design_refs Owner reads all design_refs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all design_refs" ON public.design_refs FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: design_requests Owner reads all design_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all design_requests" ON public.design_requests FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: media_releases Owner reads all media_releases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all media_releases" ON public.media_releases FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: owner_notifications Owner reads all notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all notifications" ON public.owner_notifications FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: offers Owner reads all offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all offers" ON public.offers FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: terms_acceptances Owner reads all terms_acceptances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all terms_acceptances" ON public.terms_acceptances FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: testimonials Owner reads all testimonials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads all testimonials" ON public.testimonials FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: blocked_identities Owner reads blocked identities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads blocked identities" ON public.blocked_identities FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: insights_months Owner reads insights months; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads insights months" ON public.insights_months FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: price_history Owner reads price history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner reads price history" ON public.price_history FOR SELECT TO authenticated USING ((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text)) = 'owner'::text));


--
-- Name: addons Public reads active addons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads active addons" ON public.addons FOR SELECT TO anon, authenticated USING ((archived_at IS NULL));


--
-- Name: categories Public reads active categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads active categories" ON public.categories FOR SELECT TO anon, authenticated USING ((archived_at IS NULL));


--
-- Name: services Public reads active services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads active services" ON public.services FOR SELECT TO anon, authenticated USING ((archived_at IS NULL));


--
-- Name: addon_incompatibilities Public reads addon incompatibilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads addon incompatibilities" ON public.addon_incompatibilities FOR SELECT TO anon, authenticated USING (true);


--
-- Name: asset_usages Public reads asset usages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads asset usages" ON public.asset_usages FOR SELECT TO anon, authenticated USING (true);


--
-- Name: assets Public reads assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads assets" ON public.assets FOR SELECT TO anon, authenticated USING (true);


--
-- Name: booking_settings Public reads booking settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads booking settings" ON public.booking_settings FOR SELECT TO anon, authenticated USING (true);


--
-- Name: feature_flags Public reads feature flags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads feature flags" ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);


--
-- Name: gallery_items Public reads gallery items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads gallery items" ON public.gallery_items FOR SELECT TO anon, authenticated USING (true);


--
-- Name: reviews Public reads reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (true);


--
-- Name: schedule_rules Public reads schedule rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads schedule rules" ON public.schedule_rules FOR SELECT TO anon, authenticated USING (true);


--
-- Name: service_addons Public reads service addons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads service addons" ON public.service_addons FOR SELECT TO anon, authenticated USING (true);


--
-- Name: service_sections Public reads service sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads service sections" ON public.service_sections FOR SELECT TO anon, authenticated USING (true);


--
-- Name: terms Public reads terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads terms" ON public.terms FOR SELECT TO anon, authenticated USING (true);


--
-- Name: testimonials Public reads visible testimonials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads visible testimonials" ON public.testimonials FOR SELECT TO anon, authenticated USING (((visible = true) AND (status = 'submitted'::text)));


--
-- Name: bookings Users read own bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own bookings" ON public.bookings FOR SELECT TO authenticated USING ((client_id = public.current_client_id()));


--


-- --------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Enabled on all 35 tables. RLS is the boundary — see docs/architecture.md.
-- --------------------------------------------------------------------------

-- Name: addon_incompatibilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addon_incompatibilities ENABLE ROW LEVEL SECURITY;

--
-- Name: addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_usages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_usages ENABLE ROW LEVEL SECURITY;

--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_identities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_identities ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_protection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_protection ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: business_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: client_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: client_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_media ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: communications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

--
-- Name: design_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: design_refs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_refs ENABLE ROW LEVEL SECURITY;

--
-- Name: design_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: gallery_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

--
-- Name: insights_months; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insights_months ENABLE ROW LEVEL SECURITY;

--
-- Name: media_releases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_releases ENABLE ROW LEVEL SECURITY;

--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

--
-- Name: owner_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: price_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: service_addons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;

--
-- Name: service_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: terms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

--
-- Name: terms_acceptances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

--
-- Name: testimonials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

--


-- --------------------------------------------------------------------------
-- GRANTS
-- Supabase's default privileges cover the rest; these are the deliberate exceptions.
-- --------------------------------------------------------------------------

-- Name: FUNCTION purge_expired_rate_limits(p_older_than interval); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_expired_rate_limits(p_older_than interval) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_expired_rate_limits(p_older_than interval) TO service_role;


--
-- Name: FUNCTION take_rate_limit_token(p_key text, p_limit integer, p_window interval); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.take_rate_limit_token(p_key text, p_limit integer, p_window interval) FROM PUBLIC;
GRANT ALL ON FUNCTION public.take_rate_limit_token(p_key text, p_limit integer, p_window interval) TO service_role;


--
-- Name: COLUMN testimonials.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.testimonials TO anon;


--
-- Name: COLUMN testimonials.author_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(author_name) ON TABLE public.testimonials TO anon;


--
-- Name: COLUMN testimonials.occupation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(occupation) ON TABLE public.testimonials TO anon;


--
-- Name: COLUMN testimonials.body; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(body) ON TABLE public.testimonials TO anon;


--
-- Name: COLUMN testimonials.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(sort_order) ON TABLE public.testimonials TO anon;


--
-- Name: COLUMN testimonials.submitted_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(submitted_at) ON TABLE public.testimonials TO anon;


--
--


-- --------------------------------------------------------------------------
-- SIGNUP TRIGGER
-- Lives on auth.users, so pg_dump of the public schema never sees it — and
-- without it a new sign-in creates no `clients` row and the person has no
-- identity in the app. The one statement here that is easiest to lose.
-- --------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_client_on_auth_user();


-- --------------------------------------------------------------------------
-- REALTIME
-- The admin queue subscribes to these three. Guarded, because a fresh Supabase
-- project already has the publication and re-adding a table is an error.
-- --------------------------------------------------------------------------

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['bookings', 'booking_requests', 'design_requests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- --------------------------------------------------------------------------
-- INHERITED HARDENING
-- `rls_auto_enable()` is not ours — it predates the project in some Supabase
-- instances and the security advisor flags its PUBLIC execute grant. Revoked
-- if present, ignored if not, so this file is safe on a clean project.
-- --------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
