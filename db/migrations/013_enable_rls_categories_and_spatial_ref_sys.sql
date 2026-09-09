-- Fixes Supabase linter errors:
-- 1/2. inventory_domain.categories has the "categories_select_all" policy from
--      000_baseline.sql but RLS was never enabled on the table, so the policy
--      has no effect (Postgres ignores policies when RLS is off).
--
-- NOTE on the 3rd linter error (public.spatial_ref_sys "RLS not enabled"):
-- this table is created and owned by the PostGIS extension (owned by a
-- Supabase-managed system role, not the "postgres" role used in the SQL
-- editor / migrations), so `ALTER TABLE public.spatial_ref_sys ENABLE ROW
-- LEVEL SECURITY` fails with "must be owner of table spatial_ref_sys" even
-- for the project owner. This cannot be fixed with a plain SQL migration.
-- It only holds public, non-sensitive SRID reference data (no user data),
-- so the standard remediation is to dismiss/acknowledge this specific
-- finding in the Supabase Dashboard's Security Advisor rather than "fixing"
-- it — see https://supabase.com/docs/guides/database/database-linter#rls-disabled-in-public
-- (spatial_ref_sys is called out there as a known PostGIS exception).

ALTER TABLE "inventory_domain"."categories" ENABLE ROW LEVEL SECURITY;
