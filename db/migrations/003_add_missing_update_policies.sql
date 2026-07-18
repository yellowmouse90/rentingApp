-- Row Level Security enables blocking of any command without a matching
-- policy: 001_create_interactions_schema.sql only defined SELECT/INSERT
-- policies for conversations and messages, so UPDATE statements (marking
-- last_message_at, marking messages as read) were silently no-ops (0 rows
-- affected, no error).

-- Participants can update their own conversation (e.g. last_message_at).
CREATE POLICY conversations_update_policy ON interactions_domain.conversations
  FOR UPDATE USING (
    auth.uid() = participant_one OR auth.uid() = participant_two
  )
  WITH CHECK (
    auth.uid() = participant_one OR auth.uid() = participant_two
  );

-- Participants can update messages in their conversations (e.g. is_read).
CREATE POLICY messages_update_policy ON interactions_domain.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM interactions_domain.conversations
      WHERE id = messages.conversation_id
      AND (participant_one = auth.uid() OR participant_two = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interactions_domain.conversations
      WHERE id = messages.conversation_id
      AND (participant_one = auth.uid() OR participant_two = auth.uid())
    )
  );

-- Make the last_message_at trigger robust regardless of the caller's RLS
-- context (it should always be able to maintain this derived timestamp).
CREATE OR REPLACE FUNCTION interactions_domain.update_conversation_last_message()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = interactions_domain, pg_temp
AS $$
BEGIN
  UPDATE interactions_domain.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
