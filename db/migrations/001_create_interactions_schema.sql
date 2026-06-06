-- Chat / Interactions Domain Schema for Rental App
-- This schema contains tables for inter-user communication

-- Create the interactions_domain schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS interactions_domain;

-- Conversations table - one conversation per rental order
-- Links two users together to communicate about a specific rental
CREATE TABLE IF NOT EXISTS interactions_domain.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_order_id UUID NOT NULL,
  participant_one UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure only one conversation per rental order
  UNIQUE(rental_order_id),
  
  -- Ensure both participants are different
  CHECK (participant_one != participant_two)
);

-- Messages table - stores individual messages in conversations
CREATE TABLE IF NOT EXISTS interactions_domain.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES interactions_domain.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Index for faster queries
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_created_at (created_at)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_participant_one 
  ON interactions_domain.conversations(participant_one);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_two 
  ON interactions_domain.conversations(participant_two);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at 
  ON interactions_domain.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
  ON interactions_domain.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
  ON interactions_domain.messages(sender_id);

-- Enable Row Level Security
ALTER TABLE interactions_domain.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions_domain.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see conversations they're part of
CREATE POLICY conversations_read_policy ON interactions_domain.conversations
  FOR SELECT USING (
    auth.uid() = participant_one OR auth.uid() = participant_two
  );

CREATE POLICY conversations_insert_policy ON interactions_domain.conversations
  FOR INSERT WITH CHECK (
    auth.uid() = participant_one OR auth.uid() = participant_two
  );

-- RLS Policy: Users can only see messages from conversations they're part of
CREATE POLICY messages_read_policy ON interactions_domain.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM interactions_domain.conversations
      WHERE id = messages.conversation_id
      AND (participant_one = auth.uid() OR participant_two = auth.uid())
    )
  );

CREATE POLICY messages_insert_policy ON interactions_domain.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM interactions_domain.conversations
      WHERE id = conversation_id
      AND (participant_one = auth.uid() OR participant_two = auth.uid())
    )
  );

-- Trigger to update last_message_at when a new message is created
CREATE OR REPLACE FUNCTION interactions_domain.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE interactions_domain.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON interactions_domain.messages
FOR EACH ROW
EXECUTE FUNCTION interactions_domain.update_conversation_last_message();
