-- Device tokens for push notifications (FCM), notifications_domain
--
-- Registered by the user's own session (Flutter app, POST /api/notifications/device-tokens) -
-- unlike notifications_domain.notifications itself, this write belongs entirely to the caller's
-- own account, so it goes through the user-scoped client with RLS (see CLAUDE.md's "Two Supabase
-- clients" section), not the admin client.
--
-- (user_id, token) is UNIQUE, not token alone: an upsert on that pair never needs to UPDATE a row
-- owned by a *different* user (which the RLS policies below would correctly block), so a device
-- re-registering after a login on the same account is always an idempotent no-op write it's
-- allowed to make. A stale token still tied to a previous account on the same device is cleaned
-- up by the client's own unregister-on-logout call (see PushNotificationsService.stop() in the
-- Flutter app), not by a DB constraint.

CREATE TABLE IF NOT EXISTS notifications_domain.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON notifications_domain.device_tokens(user_id);

ALTER TABLE notifications_domain.device_tokens ENABLE ROW LEVEL SECURITY;

-- A user manages only their own tokens directly - see header comment above.
CREATE POLICY device_tokens_select_policy ON notifications_domain.device_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY device_tokens_insert_policy ON notifications_domain.device_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY device_tokens_update_policy ON notifications_domain.device_tokens
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY device_tokens_delete_policy ON notifications_domain.device_tokens
  FOR DELETE USING (user_id = auth.uid());

-- service_role needs explicit grants for custom schemas (see migrations 006/008's header
-- comments) - lib/notifications/push.ts reads every token for a recipient_id via the admin
-- client when fanning out a push, and deletes tokens FCM itself reports as stale, both being
-- cross-user operations the policies above deliberately don't allow for `authenticated`.
GRANT SELECT, DELETE ON notifications_domain.device_tokens TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications_domain.device_tokens TO authenticated;
