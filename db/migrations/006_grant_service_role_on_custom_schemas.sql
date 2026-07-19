-- The custom schemas (rentals_domain, users_domain, inventory_domain,
-- interactions_domain) were only ever granted to `anon`/`authenticated` (the
-- roles PostgREST uses for the RLS-gated user-scoped client). `service_role`
-- - used by lib/supabase/admin.ts's createAdminClient(), e.g. the Stripe
-- webhook and /api/stripe/confirm-checkout - was never granted USAGE on any
-- of them, so every admin-client query against these schemas failed with
-- "permission denied for schema ..." (Postgres error 42501). Since
-- service_role bypasses RLS, this wasn't an RLS/policy problem - the schema
-- itself was inaccessible to that role at the grant level.
--
-- Concretely this meant: the Stripe webhook could never record an "authorized"
-- transaction or move an order to "paid" (it always uses the admin client),
-- and any other admin-client read/write against these schemas (e.g. the
-- owner profile lookup in app/listings/[id]/page.tsx) silently failed too.
--
-- These GRANTs are additive only (no data or RLS policy changes) and safe to
-- re-run.

DO $$
DECLARE
  schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['rentals_domain', 'users_domain', 'inventory_domain', 'interactions_domain']
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO service_role', schema_name);
    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role', schema_name);
    EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO service_role', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO service_role', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO service_role', schema_name);
  END LOOP;
END $$;
