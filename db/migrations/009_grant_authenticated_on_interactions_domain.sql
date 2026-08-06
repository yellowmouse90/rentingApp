-- Companion to 000_baseline_core_schema.sql: interactions_domain (created by
-- 001_create_interactions_schema.sql) was never given the base
-- anon/authenticated schema+table grants that PostgREST needs to reach it at
-- all (same class of gap migration 006 fixed for service_role - see that
-- file's header). This clearly already existed on the real project before
-- migration 006 ran there (its own header says interactions_domain already
-- had these grants, only service_role was missing) - this migration exists
-- solely so a *fresh* database built from 000 -> 008 ends up in that same
-- state; running it against the already-working dev DB is a harmless no-op.
--
-- Must run after 001 (needs the schema/tables to exist).

GRANT USAGE ON SCHEMA interactions_domain TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON interactions_domain.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON interactions_domain.messages TO authenticated;
