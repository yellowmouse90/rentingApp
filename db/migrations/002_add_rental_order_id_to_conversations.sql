-- Add rental_order_id column to conversations table
-- This links conversations to specific rental orders

ALTER TABLE interactions_domain.conversations
ADD COLUMN rental_order_id UUID;

-- Add unique constraint to ensure one conversation per rental order
ALTER TABLE interactions_domain.conversations
ADD CONSTRAINT unique_rental_order_conversation UNIQUE(rental_order_id);

-- Create index for faster lookups
CREATE INDEX idx_conversations_rental_order_id 
ON interactions_domain.conversations(rental_order_id);
