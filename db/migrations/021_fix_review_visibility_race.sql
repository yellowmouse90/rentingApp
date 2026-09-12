-- reviews_domain.apply_visibility_rules (migration 012) looks for the mirror review with a
-- plain SELECT and, if found, flips both rows visible. Under Postgres's default READ COMMITTED
-- isolation, two concurrent INSERTs for the two sides of the same booking (both parties
-- submitting their review within the same window) can each run that SELECT before the other has
-- committed - neither sees the other's row, so both insert with visible = false and neither's
-- mirror UPDATE fires. The two matching reviews then stay hidden indefinitely instead of
-- flipping visible together, only self-healing via the 14-day reveal-expired-reviews cron -
-- silently defeating the "immediate" half of the double-blind spec.
--
-- Fixed with a per-booking transaction-scoped advisory lock: the first trigger invocation to
-- acquire it proceeds immediately (finds no mirror, inserts hidden); a concurrent second
-- invocation for the same booking blocks until the first transaction commits, then reliably
-- sees the now-committed mirror row and flips both to visible. Scoped to the 'p2p' branch only,
-- since that's the only path with a mirror-row race to serialize.

CREATE OR REPLACE FUNCTION reviews_domain.apply_visibility_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, reviews_domain
AS $$
DECLARE
  v_mirror_id UUID;
BEGIN
  IF NEW.context = 'ferramenta' AND NEW.target_role = 'lender' THEN
    NEW.visible := TRUE;
    NEW.visible_at := NOW();
  ELSIF NEW.context = 'ferramenta' AND NEW.target_role = 'renter' THEN
    -- Internal-only ferramenta note on a customer (spec sez. 6, "eventuale
    -- controllo qualità clienti") - stays hidden, there is no public
    -- surface or staff UI for it in this iteration.
    NEW.visible := FALSE;
    NEW.visible_at := NULL;
  ELSIF NEW.context = 'p2p' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.booking_id::text, 0));

    SELECT id INTO v_mirror_id
      FROM reviews_domain.reviews
     WHERE booking_id = NEW.booking_id
       AND author_user_id = NEW.target_user_id
       AND target_user_id = NEW.author_user_id
     LIMIT 1;

    IF v_mirror_id IS NOT NULL THEN
      NEW.visible := TRUE;
      NEW.visible_at := NOW();

      UPDATE reviews_domain.reviews
         SET visible = TRUE, visible_at = NOW(), updated_at = NOW()
       WHERE id = v_mirror_id AND visible = FALSE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
