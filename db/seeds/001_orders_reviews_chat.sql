-- Seed data: rental orders, reviews and chat messages for EXISTING users/listings only.
--
-- This does NOT create any users_domain.profiles or inventory_domain.listings rows - it only
-- reads whatever already exists (profiles come from real signups via auth.users trigger
-- users_domain.handle_new_user(), listings from the app's own listing-creation flow) and builds
-- a booking history on top of it. It lives in db/seeds/ rather than db/migrations/ on purpose:
-- it's test/demo data, not a schema change, so it's not meant to run as part of the numbered
-- migration sequence in that folder (see that folder's own header comments).
--
-- For every active listing that doesn't already have an order (so re-running this script is a
-- no-op the second time - see the NOT EXISTS filter below), it:
--   1. Pairs the listing's owner with a different existing profile as the renter, round-robin by
--      account creation order, so with enough listings everyone ends up on both sides of the
--      marketplace (owner on some bookings, renter on others).
--   2. Creates one rentals_domain.rental_orders/rental_items pair, cycling through all 7
--      lifecycle statuses (pending/accepted/paid/in_progress/completed/cancelled/disputed) so
--      every status is represented, with dates/timestamps consistent with that status (see
--      CLAUDE.md's "Booking lifecycle" section for the real status/action flow this mirrors).
--   3. Adds a matching rentals_domain.transactions row for every status that would have reached
--      Stripe in the real flow (paid/in_progress/disputed -> 'authorized', since capture only
--      happens at mark_returned_ok; completed -> 'captured'). pending/accepted/cancelled orders
--      never reach payment, so they get no transaction row, same as the real app.
--   4. For 'completed' orders, adds reviews_domain.reviews rows: every completed order gets a
--      renter->owner ("lender") review, and every other one (alternating by listing order) also
--      gets the owner->renter ("renter") mirror. context is derived the same way the real API
--      route/DB trigger do (users_domain.profiles.account_type = 'business' -> 'ferramenta',
--      else 'p2p'). This produces, via the reviews_domain.apply_visibility_rules trigger
--      (db/migrations/012_create_reviews_schema.sql), a realistic mix: ferramenta reviews
--      published immediately, mutually-revealed p2p pairs, and a lone p2p review still hidden
--      awaiting its counterpart - the three visibility paths that trigger implements.
--   5. For accepted/paid/in_progress/completed/disputed orders, adds one
--      interactions_domain.conversations row (one per rental_order_id, per the unique
--      constraint) with a short, status-appropriate exchange between the two counterparties.
--
-- Run by hand against Supabase (SQL editor, or `psql ... -f db/seeds/001_orders_reviews_chat.sql`),
-- same as the files in db/migrations/ - there is no migration runner wired up in this repo.
-- Wrapped in one transaction so it either fully applies or not at all.

BEGIN;

CREATE TEMP TABLE seed_profile_ranks ON COMMIT DROP AS
SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
FROM users_domain.profiles
WHERE deleted_at IS NULL;

DO $$
DECLARE
  v_profile_count INT;
  v_listing RECORD;
  v_owner_rn INT;
  v_renter_id UUID;
  v_lender_is_business BOOLEAN;
  v_status TEXT;
  v_item_status TEXT;
  v_total_days INT;
  v_starts_in_days INT;
  v_created_days_ago INT;
  v_completed_days_ago INT;
  v_handed_over_days_ago INT;
  v_disputed_days_ago INT;
  v_subtotal INT;
  v_service_fee INT;
  v_grand_total INT;
  v_order_id UUID;
  v_item_id UUID;
  v_conversation_id UUID;
  v_msg1_sender UUID;
  v_msg1_content TEXT;
  v_msg2_sender UUID;
  v_msg2_content TEXT;
  v_last_read BOOLEAN;
  v_processed INT := 0;
  v_created INT := 0;
BEGIN
  SELECT COUNT(*) INTO v_profile_count FROM seed_profile_ranks;
  IF v_profile_count < 2 THEN
    RAISE EXCEPTION 'Servono almeno 2 utenti in users_domain.profiles per generare noleggi incrociati (trovati: %).', v_profile_count;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM inventory_domain.listings WHERE is_active = true) THEN
    RAISE EXCEPTION 'Nessun annuncio attivo trovato in inventory_domain.listings: crea prima almeno un annuncio.';
  END IF;

  FOR v_listing IN
    SELECT l.id AS listing_id, l.owner_id, l.price_per_day_cents, l.deposit_cents,
           ROW_NUMBER() OVER (ORDER BY l.created_at, l.id) AS rn
    FROM inventory_domain.listings l
    WHERE l.is_active = true
      -- Skip listings that already have ANY order (seeded or real) - keeps this script
      -- idempotent and never touches pre-existing booking data.
      AND NOT EXISTS (SELECT 1 FROM rentals_domain.rental_items ri WHERE ri.listing_id = l.id)
    ORDER BY l.created_at, l.id
  LOOP
    v_processed := v_processed + 1;

    SELECT rn INTO v_owner_rn FROM seed_profile_ranks WHERE id = v_listing.owner_id;
    IF v_owner_rn IS NULL THEN
      -- Owner isn't in the active profile set (e.g. soft-deleted) - nothing sane to pair it with.
      CONTINUE;
    END IF;

    SELECT id INTO v_renter_id FROM seed_profile_ranks WHERE rn = (v_owner_rn % v_profile_count) + 1;
    IF v_renter_id IS NULL OR v_renter_id = v_listing.owner_id THEN
      CONTINUE;
    END IF;

    v_status := (ARRAY['pending','accepted','paid','in_progress','completed','cancelled','disputed'])[((v_listing.rn - 1) % 7) + 1];
    v_item_status := CASE v_status
      WHEN 'pending' THEN 'requested' WHEN 'accepted' THEN 'accepted' WHEN 'paid' THEN 'paid'
      WHEN 'in_progress' THEN 'collected' WHEN 'completed' THEN 'returned_ok'
      WHEN 'cancelled' THEN 'cancelled' WHEN 'disputed' THEN 'damaged'
    END;
    v_total_days := ((v_listing.rn % 4) + 2); -- 2..5 days

    v_starts_in_days := CASE v_status
      WHEN 'pending' THEN 7 WHEN 'accepted' THEN 5 WHEN 'paid' THEN 2
      WHEN 'in_progress' THEN -2 WHEN 'completed' THEN -10
      WHEN 'cancelled' THEN 10 WHEN 'disputed' THEN -6
    END;
    v_created_days_ago := CASE v_status
      WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 WHEN 'paid' THEN 1
      WHEN 'in_progress' THEN 4 WHEN 'completed' THEN 10 + (v_listing.rn % 5)
      WHEN 'cancelled' THEN 3 WHEN 'disputed' THEN 8
    END;
    -- updated_at drives the reviews_domain.can_submit_review 14-day window (see
    -- CLAUDE.md "Reviews" section) - keep completed orders well inside it.
    v_completed_days_ago := CASE WHEN v_status = 'completed' THEN 3 + (v_listing.rn % 5) ELSE NULL END;
    v_handed_over_days_ago := CASE WHEN v_status IN ('in_progress', 'disputed') THEN -v_starts_in_days ELSE NULL END;
    v_disputed_days_ago := CASE WHEN v_status = 'disputed' THEN 1 ELSE NULL END;

    v_subtotal := v_listing.price_per_day_cents * v_total_days;
    v_service_fee := ROUND(v_subtotal * 0.10);
    v_grand_total := v_subtotal + COALESCE(v_listing.deposit_cents, 0);

    INSERT INTO rentals_domain.rental_orders
      (renter_id, status, subtotal_cents, service_fee_cents, total_deposit_cents, grand_total_cents, currency_code, created_at, updated_at)
    VALUES (
      v_renter_id, v_status::rentals_domain.order_status, v_subtotal, v_service_fee,
      COALESCE(v_listing.deposit_cents, 0), v_grand_total, 'EUR',
      NOW() - (v_created_days_ago || ' days')::interval,
      NOW() - (COALESCE(v_completed_days_ago, v_disputed_days_ago, v_handed_over_days_ago, v_created_days_ago) || ' days')::interval
    )
    RETURNING id INTO v_order_id;

    INSERT INTO rentals_domain.rental_items
      (order_id, listing_id, owner_id, start_date, end_date, daily_rate_cents, total_days,
       item_subtotal_cents, deposit_cents, status, handed_over_at, returned_at, dispute_opened_at, condition_notes)
    VALUES (
      v_order_id, v_listing.listing_id, v_listing.owner_id,
      (NOW() + (v_starts_in_days || ' days')::interval)::date,
      (NOW() + ((v_starts_in_days + v_total_days) || ' days')::interval)::date,
      v_listing.price_per_day_cents, v_total_days, v_subtotal, COALESCE(v_listing.deposit_cents, 0),
      v_item_status::rentals_domain.rental_item_status,
      CASE WHEN v_handed_over_days_ago IS NOT NULL THEN NOW() - (v_handed_over_days_ago || ' days')::interval END,
      CASE WHEN v_completed_days_ago IS NOT NULL THEN NOW() - (v_completed_days_ago || ' days')::interval END,
      CASE WHEN v_disputed_days_ago IS NOT NULL THEN NOW() - (v_disputed_days_ago || ' days')::interval END,
      CASE WHEN v_status = 'disputed' THEN 'Attrezzo restituito con danni non presenti alla consegna.' END
    )
    RETURNING id INTO v_item_id;

    -- Mirrors app/api/bookings/[id]/transition: capture happens at mark_returned_ok, not at
    -- handover, and report_damage never calls Stripe - so paid/in_progress/disputed all stay
    -- 'authorized', only 'completed' reaches 'captured'. pending/accepted/cancelled never get a
    -- transaction row, same as the real app (a cancelled order in-flight voids the
    -- authorization instead of recording one).
    IF v_status IN ('paid', 'in_progress', 'disputed', 'completed') THEN
      INSERT INTO rentals_domain.transactions
        (order_id, stripe_payment_intent_id, amount_cents, platform_fee_cents, currency_code, status)
      VALUES (
        v_order_id, 'pi_seed_' || v_order_id, v_grand_total,
        CASE WHEN v_status = 'completed' THEN v_service_fee ELSE 0 END,
        'EUR', (CASE WHEN v_status = 'completed' THEN 'captured' ELSE 'authorized' END)::rentals_domain.payment_flow_status
      );
    END IF;

    IF v_status = 'completed' THEN
      SELECT (account_type = 'business') INTO v_lender_is_business
        FROM users_domain.profiles WHERE id = v_listing.owner_id;

      INSERT INTO reviews_domain.reviews (booking_id, author_user_id, target_user_id, target_role, context, overall_rating, comment, tags)
      VALUES (
        v_order_id, v_renter_id, v_listing.owner_id, 'lender',
        CASE WHEN v_lender_is_business THEN 'ferramenta' ELSE 'p2p' END,
        4 + (v_listing.rn % 2),
        'Noleggio andato bene, attrezzo funzionante e come descritto.',
        ARRAY['oggetto come descritto']
      );

      -- Mirror review only on alternating listings: gives a mix of mutually-revealed p2p pairs
      -- and a lone p2p review still hidden awaiting its counterpart (the two p2p paths in
      -- reviews_domain.apply_visibility_rules), instead of every booking looking identical.
      IF v_listing.rn % 2 = 0 THEN
        INSERT INTO reviews_domain.reviews (booking_id, author_user_id, target_user_id, target_role, context, overall_rating, comment, tags)
        VALUES (
          v_order_id, v_listing.owner_id, v_renter_id, 'renter',
          CASE WHEN v_lender_is_business THEN 'ferramenta' ELSE 'p2p' END,
          4 + ((v_listing.rn + 1) % 2),
          'Noleggiatore puntuale, riconsegna senza problemi.',
          ARRAY['puntuale']
        );
      END IF;
    END IF;

    IF v_status IN ('accepted', 'paid', 'in_progress', 'completed', 'disputed') THEN
      v_last_read := v_status IN ('completed', 'disputed');

      CASE v_status
        WHEN 'accepted' THEN
          v_msg1_sender := v_renter_id;
          v_msg1_content := 'Grazie per aver accettato! A che ora possiamo organizzare il ritiro?';
          v_msg2_sender := v_listing.owner_id;
          v_msg2_content := 'Perfetto, per me va bene qualunque orario dalle 9 alle 18.';
        WHEN 'paid' THEN
          v_msg1_sender := v_renter_id;
          v_msg1_content := 'Pagamento effettuato, confermo il ritiro come da accordi.';
          v_msg2_sender := v_listing.owner_id;
          v_msg2_content := 'Ricevuto, ti aspetto!';
        WHEN 'in_progress' THEN
          v_msg1_sender := v_renter_id;
          v_msg1_content := 'Ciao! Confermo che ho ritirato tutto, grazie.';
          v_msg2_sender := v_listing.owner_id;
          v_msg2_content := 'Perfetto, buon utilizzo!';
        WHEN 'completed' THEN
          v_msg1_sender := v_renter_id;
          v_msg1_content := 'Grazie mille, tutto perfetto!';
          v_msg2_sender := v_listing.owner_id;
          v_msg2_content := 'Grazie a te, alla prossima!';
        WHEN 'disputed' THEN
          v_msg1_sender := v_listing.owner_id;
          v_msg1_content := 'Ciao, purtroppo ho notato un danno alla riconsegna non presente alla consegna.';
          v_msg2_sender := v_renter_id;
          v_msg2_content := 'Mi dispiace, non me ne ero accorto: ne parliamo?';
      END CASE;

      INSERT INTO interactions_domain.conversations (rental_order_id, participant_one, participant_two)
      VALUES (v_order_id, v_renter_id, v_listing.owner_id)
      RETURNING id INTO v_conversation_id;

      INSERT INTO interactions_domain.messages (conversation_id, sender_id, content, is_read)
      VALUES
        (v_conversation_id, v_msg1_sender, v_msg1_content, true),
        (v_conversation_id, v_msg2_sender, v_msg2_content, v_last_read);
    END IF;

    v_created := v_created + 1;
  END LOOP;

  RAISE NOTICE 'Seed completato: % annunci idonei trovati, % ordini creati.', v_processed, v_created;
END $$;

COMMIT;

-- Quick sanity check after running: counts by status.
SELECT status, COUNT(*) AS orders
FROM rentals_domain.rental_orders
GROUP BY status
ORDER BY status;
