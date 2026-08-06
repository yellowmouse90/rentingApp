-- Add rental_order_id column to conversations table
-- This links conversations to specific rental orders
--
-- 001_create_interactions_schema.sql was since edited to create this column
-- (and its UNIQUE constraint) directly in the CREATE TABLE, so on a database
-- that already ran the current 001 this migration is a no-op - guarded so it
-- doesn't error out either way (fresh replay vs. already-migrated DB).

DO $$
BEGIN
  ALTER TABLE interactions_domain.conversations ADD COLUMN rental_order_id UUID;
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'rental_order_id already exists on conversations, skipping';
END $$;

-- Add unique constraint to ensure one conversation per rental order
DO $$
BEGIN
  ALTER TABLE interactions_domain.conversations
  ADD CONSTRAINT unique_rental_order_conversation UNIQUE(rental_order_id);
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'unique_rental_order_conversation already exists, skipping';
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_rental_order_id
ON interactions_domain.conversations(rental_order_id);
