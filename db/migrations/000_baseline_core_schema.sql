-- Baseline schema for users_domain / inventory_domain / rentals_domain.
--
-- Migrations 001-008 in this directory are all *patches* on top of a schema
-- that was originally created by hand (Supabase SQL editor / dashboard) and
-- never checked into git. That means there was previously no way to build
-- this database from zero - only to patch an existing one. This file fills
-- that gap: it reconstructs the pre-migration-001 baseline (profiles,
-- listings, bookings/rentals) so that running 000 -> 001 -> ... -> 008 in
-- order against an empty Postgres/Supabase project reproduces a working
-- schema, e.g. for a local Supabase instance or a dedicated test project.
--
-- IMPORTANT - this is a reconstruction, not a pg_dump:
-- It was derived by reading every `.schema("...").from("...")` call in the
-- app (columns actually selected/inserted/updated), the existing numbered
-- migrations (which describe, in their own comments, several policies/
-- functions/grants that already existed before they ran), and the RLS
-- silent-failure bugs those migrations fixed (which tell us what the
-- *original* - i.e. pre-fix - policies looked like). It is a best-effort
-- baseline good enough to develop and test against, but it can drift from
-- the real project in details static analysis can't recover (exact
-- constraint names, trigger bodies, storage policies). Before trusting it
-- as ground truth, cross-check against the real project's schema, e.g.
-- `supabase db dump --schema public,users_domain,inventory_domain,rentals_domain,interactions_domain,notifications_domain --schema-only`
-- (or an equivalent pg_dump against the project's connection string).
--
-- Two tables referenced by lib/types.ts (users_domain.addresses,
-- and a "reviews" table implied by profiles.average_rating_as_owner /
-- total_reviews_as_owner) are NOT backed by any live query in the app
-- today - no route reads or writes them. address is included below (best
-- effort from the UserAddress TS type, since CLAUDE.md documents it as a
-- real users_domain table) but flagged as unconfirmed. A reviews table is
-- deliberately NOT included - there isn't enough evidence in the app to
-- reconstruct it, and the rating columns are always hardcoded to 0 wherever
-- profiles are created, never updated anywhere in the codebase.

-- Supabase's own convention is to install extensions into a dedicated
-- `extensions` schema (not `public`) and include it in the default search_path -
-- matched here rather than the plain-Postgres default so this lines up with
-- how the real project almost certainly has it.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;    -- geography(Point), ST_DWithin, ST_Distance
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions; -- EXCLUDE USING gist on a uuid + daterange

-- Make sure the rest of this migration (and this session) can resolve
-- gen_random_uuid()/GEOGRAPHY/etc without schema-qualifying every use,
-- regardless of what search_path the calling session started with.
SET search_path TO "$user", public, extensions;

CREATE SCHEMA IF NOT EXISTS users_domain;
CREATE SCHEMA IF NOT EXISTS inventory_domain;
CREATE SCHEMA IF NOT EXISTS rentals_domain;

-- ============================================================================
-- users_domain
-- ============================================================================

CREATE TABLE IF NOT EXISTS users_domain.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_currency TEXT NOT NULL DEFAULT 'EUR',
  stripe_customer_id TEXT,
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  average_rating_as_owner NUMERIC(3, 2) NOT NULL DEFAULT 0,
  average_rating_as_renter NUMERIC(3, 2) NOT NULL DEFAULT 0,
  total_reviews_as_owner INTEGER NOT NULL DEFAULT 0,
  total_reviews_as_renter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- UNCONFIRMED: no route in the app currently reads/writes this table.
-- Included because CLAUDE.md documents it as part of users_domain and
-- lib/types.ts's UserAddress gives a plausible shape. Verify against the
-- real DB before relying on it.
CREATE TABLE IF NOT EXISTS users_domain.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  label TEXT,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT,
  region TEXT,
  country_code TEXT NOT NULL DEFAULT 'IT',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON users_domain.addresses(user_id);

ALTER TABLE users_domain.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_domain.addresses ENABLE ROW LEVEL SECURITY;

-- Self-only. Evidence: app/listings/[id]/page.tsx reads another user's
-- profile with the user-scoped client and explicitly falls back to the
-- admin client "if RLS blocks profile visibility", treating that as an
-- *expected* outcome - i.e. there is no policy letting one user read
-- another's profile row directly.
CREATE POLICY profiles_select_own_policy ON users_domain.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_insert_own_policy ON users_domain.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own_policy ON users_domain.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY addresses_select_own_policy ON users_domain.addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY addresses_insert_own_policy ON users_domain.addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY addresses_update_own_policy ON users_domain.addresses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY addresses_delete_own_policy ON users_domain.addresses
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- inventory_domain
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_domain.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon_name TEXT,
  parent_id UUID REFERENCES inventory_domain.categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_domain.category_translations (
  category_id UUID NOT NULL REFERENCES inventory_domain.categories(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (category_id, language_code)
);

CREATE TABLE IF NOT EXISTS inventory_domain.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES inventory_domain.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair')),
  price_per_day_cents INTEGER NOT NULL CHECK (price_per_day_cents > 0),
  price_per_week_cents INTEGER,
  currency_code TEXT NOT NULL DEFAULT 'EUR',
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  -- Geography point (lng/lat), consumed via PostGIS by search_listings_nearby below.
  -- lib/types.ts also has separate latitude/longitude/location_address_id fields, but
  -- no query in the app actually reads/writes those - item_coords + item_location_name
  -- (both used by app/listings/new, app/listings/[id]/edit and the nearby-search RPC)
  -- are what's really in use.
  item_coords GEOGRAPHY(POINT, 4326),
  item_location_name TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_domain.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES inventory_domain.listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- UNCONFIRMED write path: read by app/listings/[id]/page.tsx (unavailable_date),
-- no INSERT/UPDATE call found anywhere in the app - owner-management UI for this
-- may not be built yet. Policies below assume owner-managed, symmetric with listings.
CREATE TABLE IF NOT EXISTS inventory_domain.listing_availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES inventory_domain.listings(id) ON DELETE CASCADE,
  unavailable_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, unavailable_date)
);

CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON inventory_domain.listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_category_id ON inventory_domain.listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_active_available ON inventory_domain.listings(is_active, is_available);
CREATE INDEX IF NOT EXISTS idx_listings_item_coords ON inventory_domain.listings USING GIST (item_coords);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON inventory_domain.listing_images(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_availability_exceptions_listing_id ON inventory_domain.listing_availability_exceptions(listing_id);

ALTER TABLE inventory_domain.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_domain.category_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_domain.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_domain.listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_domain.listing_availability_exceptions ENABLE ROW LEVEL SECURITY;

-- Reference data: public read, no app-level write path (managed by admins/service_role).
CREATE POLICY categories_select_policy ON inventory_domain.categories
  FOR SELECT USING (true);

CREATE POLICY category_translations_select_policy ON inventory_domain.category_translations
  FOR SELECT USING (true);

-- Public browsing needs to see active listings; the owner also needs to see
-- their own inactive ones (dashboard, edit page, "my own inactive listing" view).
CREATE POLICY listings_select_policy ON inventory_domain.listings
  FOR SELECT USING (is_active = true OR owner_id = auth.uid());

CREATE POLICY listings_insert_own_policy ON inventory_domain.listings
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY listings_update_own_policy ON inventory_domain.listings
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Images/exceptions are rendered on the public listing page - no reason to gate SELECT.
CREATE POLICY listing_images_select_policy ON inventory_domain.listing_images
  FOR SELECT USING (true);

CREATE POLICY listing_images_insert_owner_policy ON inventory_domain.listing_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_domain.listings
      WHERE listings.id = listing_images.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

CREATE POLICY listing_images_delete_owner_policy ON inventory_domain.listing_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM inventory_domain.listings
      WHERE listings.id = listing_images.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

CREATE POLICY listing_availability_exceptions_select_policy ON inventory_domain.listing_availability_exceptions
  FOR SELECT USING (true);

CREATE POLICY listing_availability_exceptions_owner_write_policy ON inventory_domain.listing_availability_exceptions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_domain.listings
      WHERE listings.id = listing_availability_exceptions.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

CREATE POLICY listing_availability_exceptions_owner_delete_policy ON inventory_domain.listing_availability_exceptions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM inventory_domain.listings
      WHERE listings.id = listing_availability_exceptions.listing_id
      AND listings.owner_id = auth.uid()
    )
  );

-- Nearby search (components/listings/listings-grid-location.tsx calls
-- inventory_domain.rpc("search_listings_nearby", {...})). SECURITY DEFINER is
-- required here for the same reason the app falls back to the admin client on
-- the listing detail page: profiles is self-select-only, so a plain caller
-- could not read owner_display_name/owner_avatar_url/owner_rating for anyone
-- else's listings.
CREATE OR REPLACE FUNCTION inventory_domain.search_listings_nearby(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  category_slug TEXT DEFAULT NULL,
  search_query TEXT DEFAULT NULL,
  min_price INTEGER DEFAULT NULL,
  max_price INTEGER DEFAULT NULL,
  item_condition TEXT DEFAULT NULL,
  page_limit INTEGER DEFAULT 20,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  category_id UUID,
  title TEXT,
  description TEXT,
  condition TEXT,
  price_per_day_cents INTEGER,
  price_per_week_cents INTEGER,
  currency_code TEXT,
  deposit_cents INTEGER,
  item_location_name TEXT,
  is_available BOOLEAN,
  views_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  distance_km DOUBLE PRECISION,
  owner_display_name TEXT,
  owner_avatar_url TEXT,
  owner_rating NUMERIC,
  category_name TEXT,
  category_icon TEXT,
  first_image_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = inventory_domain, users_domain, extensions, pg_temp
AS $$
  SELECT
    l.id, l.owner_id, l.category_id, l.title, l.description, l.condition,
    l.price_per_day_cents, l.price_per_week_cents, l.currency_code, l.deposit_cents,
    l.item_location_name, l.is_available, l.views_count, l.created_at,
    ST_Distance(
      l.item_coords,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000.0 AS distance_km,
    p.display_name AS owner_display_name,
    p.avatar_url AS owner_avatar_url,
    p.average_rating_as_owner AS owner_rating,
    c.name AS category_name,
    c.icon_name AS category_icon,
    (
      SELECT li.image_url FROM inventory_domain.listing_images li
      WHERE li.listing_id = l.id
      ORDER BY li.display_order ASC
      LIMIT 1
    ) AS first_image_url
  FROM inventory_domain.listings l
  JOIN users_domain.profiles p ON p.id = l.owner_id
  LEFT JOIN inventory_domain.categories c ON c.id = l.category_id
  WHERE l.is_active = true
    AND l.is_available = true
    AND l.item_coords IS NOT NULL
    AND ST_DWithin(
      l.item_coords,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (category_slug IS NULL OR c.slug = category_slug)
    AND (search_query IS NULL OR l.title ILIKE '%' || search_query || '%')
    AND (min_price IS NULL OR l.price_per_day_cents >= min_price)
    AND (max_price IS NULL OR l.price_per_day_cents <= max_price)
    AND (item_condition IS NULL OR l.condition = item_condition)
  ORDER BY distance_km ASC
  LIMIT page_limit OFFSET page_offset;
$$;

-- ============================================================================
-- rentals_domain
-- ============================================================================

-- status/condition-adjacent free-text columns below are intentionally left
-- without CHECK constraints: lib/types.ts's unions (e.g. "approved"/"ongoing"
-- on RentalOrder/RentalItem) look like earlier, now-unused values still
-- carried in the app's TS types, and the real DB's constraints (if any)
-- can't be recovered from static analysis - a wrong CHECK here would be
-- worse than none. Values actually driven by app/api/bookings/[id]/transition
-- and components/bookings/booking-form.tsx (the ones that matter for the
-- documented lifecycle in CLAUDE.md):
--   rental_orders.status: pending, accepted, cancelled, paid, in_progress, completed, disputed
--   rental_items.status:  requested, accepted, cancelled, paid, collected, returned_ok, damaged, unavailable
--   transactions.status:  authorized, captured, failed, requires_payment_method

CREATE TABLE IF NOT EXISTS rentals_domain.rental_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renter_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL,
  service_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_deposit_cents INTEGER NOT NULL DEFAULT 0,
  grand_total_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rentals_domain.rental_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES rentals_domain.rental_orders(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES inventory_domain.listings(id),
  owner_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  daily_rate_cents INTEGER NOT NULL,
  total_days INTEGER NOT NULL CHECK (total_days > 0),
  item_subtotal_cents INTEGER NOT NULL,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested',
  handed_over_at TIMESTAMP WITH TIME ZONE,
  returned_at TIMESTAMP WITH TIME ZONE,
  dispute_opened_at TIMESTAMP WITH TIME ZONE,
  condition_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- components/bookings/booking-form.tsx explicitly handles Postgres error
  -- code 23P01 (exclusion_violation) from this insert as "dates unavailable",
  -- which only exists if double-booking is enforced at the DB level via an
  -- EXCLUDE constraint, not just the app's own pre-check query.
  CONSTRAINT rental_items_no_overlap EXCLUDE USING gist (
    listing_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'unavailable'))
);

CREATE TABLE IF NOT EXISTS rentals_domain.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES rentals_domain.rental_orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL,
  stripe_transfer_id TEXT,
  platform_fee_cents INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_orders_renter_id ON rentals_domain.rental_orders(renter_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_order_id ON rentals_domain.rental_items(order_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_listing_id ON rentals_domain.rental_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_owner_id ON rentals_domain.rental_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON rentals_domain.transactions(order_id);

ALTER TABLE rentals_domain.rental_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals_domain.rental_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals_domain.transactions ENABLE ROW LEVEL SECURITY;

-- Reused by rental_orders'/rental_items' owner-facing policies below -
-- migration 007 refers to this as already existing ("Reuses the existing
-- rentals_domain.bypass_is_order_owner(...) ... helper, already used by
-- rental_orders/rental_items policies"), so it predates migration 001.
CREATE OR REPLACE FUNCTION rentals_domain.bypass_is_order_owner(order_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rentals_domain, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM rentals_domain.rental_items
    WHERE rental_items.order_id = order_uuid
    AND rental_items.owner_id = user_uuid
  );
$$;

-- rental_orders: renter can see/create their own orders; the owner (found via
-- the linked rental_items row) can see them too - both dashboards and
-- app/api/bookings/[id]/transition read rental_orders as either party.
-- UPDATE is intentionally renter-only here: migration 005's header comment
-- states this directly ("only the renter has an UPDATE policy on it") before
-- adding the owner-side UPDATE policy that migration 005 itself contributes.
CREATE POLICY rental_orders_select_policy ON rentals_domain.rental_orders
  FOR SELECT USING (
    auth.uid() = renter_id
    OR rentals_domain.bypass_is_order_owner(id, auth.uid())
  );

CREATE POLICY rental_orders_insert_own_policy ON rentals_domain.rental_orders
  FOR INSERT WITH CHECK (auth.uid() = renter_id);

CREATE POLICY rental_orders_renter_update_policy ON rentals_domain.rental_orders
  FOR UPDATE USING (auth.uid() = renter_id) WITH CHECK (auth.uid() = renter_id);

-- rental_items: both public browsing (listing detail page's "unavailable
-- dates" query) and the renter's own client-side overlap pre-check
-- (booking-form.tsx) read this table with no session guarantee, so SELECT
-- has to be broad. Dates/status alone aren't sensitive.
CREATE POLICY rental_items_select_policy ON rentals_domain.rental_items
  FOR SELECT USING (true);

-- The renter creates this row (naming the LISTING'S owner in owner_id, not
-- themselves) right after creating the parent order - so the check has to
-- go through rental_orders.renter_id, not owner_id = auth.uid().
CREATE POLICY rental_items_insert_via_order_policy ON rentals_domain.rental_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM rentals_domain.rental_orders
      WHERE rental_orders.id = rental_items.order_id
      AND rental_orders.renter_id = auth.uid()
    )
  );

CREATE POLICY rental_items_owner_select_via_function_policy ON rentals_domain.rental_items
  FOR SELECT USING (owner_id = auth.uid());

-- transactions: pre-007 state per migration 007's own description - renter
-- SELECT only, no owner policy, no UPDATE policy at all (both added by 007).
CREATE POLICY transactions_select_own ON rentals_domain.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rentals_domain.rental_orders
      WHERE rental_orders.id = transactions.order_id
      AND rental_orders.renter_id = auth.uid()
    )
  );

-- ============================================================================
-- Base grants (anon/authenticated) for the three schemas created here.
--
-- Custom schemas are not auto-granted to PostgREST's anon/authenticated
-- roles (same gotcha migration 006 documents for service_role) - these were
-- clearly already in place for users_domain/inventory_domain/rentals_domain
-- before migration 001 (nothing in this repo's history adds them), so they
-- belong in the baseline. interactions_domain needs the equivalent grants
-- too (migration 001 creates its tables/policies but never grants
-- schema/table access to anon/authenticated, and migration 006's header
-- says interactions_domain already had those grants pre-006) - but that
-- schema and its tables don't exist yet at this point in the replay (001
-- creates them), so that grant is added in 009_grant_authenticated_on_interactions_domain.sql
-- instead, to run after 001.
-- ============================================================================

GRANT USAGE ON SCHEMA users_domain, inventory_domain, rentals_domain TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON users_domain.profiles TO authenticated;
GRANT SELECT ON users_domain.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON users_domain.addresses TO authenticated;

GRANT SELECT ON inventory_domain.categories, inventory_domain.category_translations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON inventory_domain.listings TO authenticated;
GRANT SELECT ON inventory_domain.listings TO anon;
GRANT SELECT, INSERT, DELETE ON inventory_domain.listing_images TO authenticated;
GRANT SELECT ON inventory_domain.listing_images TO anon;
GRANT SELECT, INSERT, DELETE ON inventory_domain.listing_availability_exceptions TO authenticated;
GRANT SELECT ON inventory_domain.listing_availability_exceptions TO anon;
GRANT EXECUTE ON FUNCTION inventory_domain.search_listings_nearby TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON rentals_domain.rental_orders TO authenticated;
GRANT SELECT, INSERT ON rentals_domain.rental_items TO authenticated;
GRANT SELECT ON rentals_domain.rental_items TO anon;
GRANT SELECT ON rentals_domain.transactions TO authenticated;

-- service_role: granted here too (not just in migration 006) so a fresh
-- replay of 000 alone already lets the admin client (Stripe webhook, etc.)
-- reach these schemas; migration 006 re-running afterwards is then a no-op.
DO $$
DECLARE
  schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['users_domain', 'inventory_domain', 'rentals_domain']
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO service_role', schema_name);
    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role', schema_name);
    EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO service_role', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO service_role', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO service_role', schema_name);
  END LOOP;
END $$;

-- ============================================================================
-- Storage: listing image uploads (app/listings/new, app/listings/[id]/edit
-- upload to the "listing-images" bucket, path "<listing_id>/<file>").
-- Best effort - storage bucket configuration (public/private, size/type
-- limits) is commonly done via the Supabase dashboard and isn't observable
-- from application code at all. Verify against the real project.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  CREATE POLICY listing_images_bucket_public_read ON storage.objects
    FOR SELECT USING (bucket_id = 'listing-images');
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'listing_images_bucket_public_read already exists, skipping';
END $$;

DO $$
BEGIN
  CREATE POLICY listing_images_bucket_owner_write ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'listing-images'
      AND EXISTS (
        SELECT 1 FROM inventory_domain.listings
        WHERE listings.id::text = (storage.foldername(name))[1]
        AND listings.owner_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'listing_images_bucket_owner_write already exists, skipping';
END $$;

-- ============================================================================
-- Optional minimal category seed - safe to skip/edit, only useful to have
-- something to attach listings to in a fresh test database.
-- ============================================================================

INSERT INTO inventory_domain.categories (name, slug, icon_name) VALUES
  ('Attrezzi', 'attrezzi', 'wrench'),
  ('Elettronica', 'elettronica', 'cpu'),
  ('Sport e tempo libero', 'sport-tempo-libero', 'bike'),
  ('Casa e giardino', 'casa-giardino', 'home')
ON CONFLICT (slug) DO NOTHING;
