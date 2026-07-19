-- Notifications Domain Schema for Rental App
--
-- Adds a generic in-app + email notification system (booking status changes,
-- payment outcomes, Stripe onboarding completion). Follows the same
-- per-domain-schema convention as interactions_domain/rentals_domain/etc.
--
-- Notifications are always written cross-user (actor -> recipient) by trusted
-- server code using the admin/service-role client (see lib/supabase/admin.ts),
-- never by the actor's own RLS-gated session - there is no legitimate reason
-- for a user's own session to write into someone else's inbox. That's why
-- there is deliberately no INSERT policy for `authenticated` on `notifications`
-- below: service_role bypasses RLS entirely for that write path.
--
-- Pre-empting the two gotchas already hit twice in this repo (migrations 003
-- and 006): every RLS-protected command needs its own explicit policy (a
-- missing one silently blocks with 0 rows, no error), and custom schemas are
-- NOT auto-granted to `service_role` (or to `anon`/`authenticated` for that
-- matter) - both grant sets are included directly in this file instead of
-- needing a follow-up migration.

CREATE SCHEMA IF NOT EXISTS notifications_domain;

CREATE TABLE IF NOT EXISTS notifications_domain.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users_domain.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  related_order_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications_domain.notification_preferences (
  user_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications_domain.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications_domain.notifications(recipient_id, created_at DESC);

ALTER TABLE notifications_domain.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_domain.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications: recipients can read their own and mark their own as read.
-- No INSERT policy for `authenticated` - see header comment.
CREATE POLICY notifications_select_policy ON notifications_domain.notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY notifications_update_policy ON notifications_domain.notifications
  FOR UPDATE USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Preferences: a user manages only their own rows (no seeding - see
-- lib/notifications/preferences.ts, missing rows fall back to a default map
-- applied in code, so INSERT here only ever happens as an upsert-on-save from
-- the preferences page).
CREATE POLICY notification_preferences_select_policy ON notifications_domain.notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notification_preferences_insert_policy ON notifications_domain.notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_preferences_update_policy ON notifications_domain.notification_preferences
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- service_role needs explicit schema/table grants for custom schemas (see
-- migration 006's header comment for the full explanation of why).
DO $$
BEGIN
  EXECUTE 'GRANT USAGE ON SCHEMA notifications_domain TO service_role';
  EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA notifications_domain TO service_role';
  EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA notifications_domain TO service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA notifications_domain GRANT ALL ON TABLES TO service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA notifications_domain GRANT ALL ON SEQUENCES TO service_role';
END $$;

-- Base grants so PostgREST can even reach the RLS-gated policies above for
-- the anon/authenticated roles (mirrors how the other custom schemas work).
GRANT USAGE ON SCHEMA notifications_domain TO authenticated, anon;
GRANT SELECT, UPDATE ON notifications_domain.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notifications_domain.notification_preferences TO authenticated;
