-- Today, deleting a profile CASCADEs through interactions_domain.conversations
-- and interactions_domain.messages, wiping the whole chat history for the
-- OTHER participant too (participant_one/participant_two/sender_id are all
-- ON DELETE CASCADE). Switch to ON DELETE SET NULL instead: the deleted
-- user's identity is anonymized (their id becomes NULL on the row) but the
-- conversation and message content remain for whoever is left.
--
-- This requires participant_one/participant_two/sender_id to become
-- nullable. The app already treats a missing other_participant_details /
-- null sender_id as "utente eliminato" (see conversations route and
-- message-list.tsx).

ALTER TABLE interactions_domain.conversations
  ALTER COLUMN participant_one DROP NOT NULL,
  ALTER COLUMN participant_two DROP NOT NULL;

ALTER TABLE interactions_domain.messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- Find and drop the existing single-column FK constraint on (schema, table,
-- column) without relying on Postgres's default naming convention, then
-- recreate it with ON DELETE SET NULL.
DO $$
DECLARE
  targets text[][] := ARRAY[
    ARRAY['conversations', 'participant_one'],
    ARRAY['conversations', 'participant_two'],
    ARRAY['messages', 'sender_id']
  ];
  target text[];
  found_conname text;
BEGIN
  FOREACH target SLICE 1 IN ARRAY targets LOOP
    SELECT con.conname INTO found_conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'interactions_domain'
      AND rel.relname = target[1]
      AND att.attname = target[2]
      AND con.contype = 'f'
      AND array_length(con.conkey, 1) = 1;

    IF found_conname IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE interactions_domain.%I DROP CONSTRAINT %I',
        target[1], found_conname
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE interactions_domain.conversations
  ADD CONSTRAINT conversations_participant_one_fkey
    FOREIGN KEY (participant_one) REFERENCES users_domain.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT conversations_participant_two_fkey
    FOREIGN KEY (participant_two) REFERENCES users_domain.profiles(id) ON DELETE SET NULL;

ALTER TABLE interactions_domain.messages
  ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES users_domain.profiles(id) ON DELETE SET NULL;
