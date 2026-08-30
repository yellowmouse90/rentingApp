-- Add rental_order_id column to conversations table
-- This links conversations to specific rental orders
--
-- Guarded with IF NOT EXISTS / existence checks: 001_create_interactions_schema.sql was later
-- edited to declare this column (and its UNIQUE constraint) inline, so on a fresh database this
-- migration is a no-op that follows the already-applied 001 rather than conflicting with it.

ALTER TABLE interactions_domain.conversations
ADD COLUMN IF NOT EXISTS rental_order_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_rental_order_conversation'
  ) THEN
    ALTER TABLE interactions_domain.conversations
    ADD CONSTRAINT unique_rental_order_conversation UNIQUE(rental_order_id);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_rental_order_id
ON interactions_domain.conversations(rental_order_id);
