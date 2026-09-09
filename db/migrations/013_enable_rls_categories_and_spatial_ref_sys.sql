-- Fixes 3 Supabase linter errors:
-- 1/2. inventory_domain.categories has the "categories_select_all" policy from
--      000_baseline.sql but RLS was never enabled on the table, so the policy
--      has no effect (Postgres ignores policies when RLS is off).
-- 3. public.spatial_ref_sys (PostGIS system table, SRID reference data) is
--    reachable via PostgREST like every table in an exposed schema, but has
--    no RLS. It's read-only reference data used internally by PostGIS
--    functions (e.g. search_listings_nearby), so we enable RLS and add an
--    explicit "select for everyone" policy rather than leaving it unreadable.

ALTER TABLE "inventory_domain"."categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."spatial_ref_sys" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spatial_ref_sys_select_all" ON "public"."spatial_ref_sys" FOR SELECT USING (true);
