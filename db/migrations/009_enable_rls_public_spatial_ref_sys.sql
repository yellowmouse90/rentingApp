-- Fixes Supabase's "rls_disabled_in_public" security advisory:
-- "Table `public.spatial_ref_sys` is public, but RLS has not been enabled."
--
-- This app never creates its own tables in the `public` schema - every
-- app table lives in one of the four domain schemas (users_domain,
-- inventory_domain, rentals_domain, interactions_domain,
-- notifications_domain), each already RLS-enabled (see migrations
-- 001-008). `public.spatial_ref_sys` is not one of ours: it's created
-- automatically by the PostGIS extension (used for the nearby-listings
-- geo search, see inventory_domain.search_listings_nearby /
-- components/listings/listings-grid-location.tsx) and lands in `public`
-- because that's where PostGIS installs by default.
--
-- It's a static, read-only lookup table of ~8500 spatial reference
-- system definitions (EPSG codes etc.) - not user data, and nothing in
-- this app writes to it - so enabling RLS with an open SELECT policy
-- satisfies the advisory without changing behavior for anyone.
--
-- If the Supabase dashboard names a *different* public table, run this
-- diagnostic first to see every public-schema table missing RLS, and
-- adjust accordingly:
--
--   SELECT c.relname AS table_name
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spatial_ref_sys_select_policy ON public.spatial_ref_sys;
CREATE POLICY spatial_ref_sys_select_policy ON public.spatial_ref_sys
  FOR SELECT USING (true);
