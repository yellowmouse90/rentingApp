-- Seed data: additional completed+reviewed bookings, to give every existing user more reviews
-- both as lender (owner) and as renter, on top of whatever db/seeds/001_orders_reviews_chat.sql
-- already created.
--
-- Why this is a separate script rather than bumping 001's numbers: 001 creates at most ONE order
-- per listing (one per status in its 7-status round-robin) and is guarded by a NOT EXISTS on "this
-- listing has any order at all", so it can only ever produce one review per listing owner. This
-- script tops every active listing up to a small target number of *completed* bookings
-- (v_target_orders_per_listing), each fully reviewed in both directions, so:
--   - every listing owner accumulates several target_role='lender' reviews (visible on their
--     public profile via ReviewsSection - see app/users/[id]/page.tsx, which only ever renders
--     role='lender' in phase 1) from different renters, so the average and the review list are
--     actually populated instead of a single row.
--   - the renters on those bookings each get a target_role='renter' review back (not shown by any
--     UI yet in phase 1 - see components/reviews/reviews-section.tsx's header comment - but this
--     keeps reviews_domain.user_rating_summaries and profiles.average_rating_as_renter /
--     total_reviews_as_renter correctly populated for when that surfaces).
--
-- IMPORTANT caveat: a user only gets 'lender' reviews if they own at least one active listing (no
-- listings => nothing to be reviewed as a lender for), and only gets 'renter' reviews if they get
-- picked as a renter on someone else's listing below. This script does not create listings or
-- profiles (same rule as 001), so a user with zero listings will still show no reviews/rating on
-- their own profile page even after running this.
--
-- Visibility (reviews_domain.apply_visibility_rules, migration 012): for a 'ferramenta' context
-- (business-account owner) the lender-direction review publishes immediately; for 'p2p' (the
-- default, individual-account owner) a review only becomes visible once BOTH directions exist for
-- the same booking ("doppio cieco"). This script always inserts both directions for every booking
-- it creates specifically so the p2p pairs flip to visible immediately (no need to wait for the
-- reveal-expired-reviews cron / the 14-day window) - see CLAUDE.md's "Reviews" section.
--
-- Idempotent: for each active listing it tops up to v_target_orders_per_listing total bookings
-- (counting ones 001 or a previous run of this script already created), so re-running it is a
-- no-op once every listing has reached the target.
--
-- Run by hand against Supabase (SQL editor, or `psql ... -f db/seeds/002_bulk_reviews.sql`), same
-- as 001 - there is no migration runner wired up in this repo. Wrapped in one transaction so it
-- either fully applies or not at all.

BEGIN;

CREATE TEMP TABLE seed_bulk_profile_ranks ON COMMIT DROP AS
SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
FROM users_domain.profiles
WHERE deleted_at IS NULL;

DO $$
DECLARE
  v_target_orders_per_listing CONSTANT INT := 4;
  v_profile_count INT;
  v_listing RECORD;
  v_owner_rn INT;
  v_existing_orders INT;
  v_need INT;
  v_renter_rn INT;
  v_renter_id UUID;
  v_lender_is_business BOOLEAN;
  v_context TEXT;
  v_idx INT;
  v_earliest_existing_start DATE;
  v_days_ago_cursor INT;
  v_total_days INT;
  v_completed_days_ago INT;
  v_handed_over_days_ago INT;
  v_created_days_ago INT;
  v_subtotal INT;
  v_service_fee INT;
  v_grand_total INT;
  v_order_id UUID;
  v_rating_lender INT;
  v_rating_renter INT;
  v_comment_lender TEXT;
  v_comment_renter TEXT;
  v_tags_lender TEXT[];
  v_tags_renter TEXT[];
  v_orders_created INT := 0;
BEGIN
  SELECT COUNT(*) INTO v_profile_count FROM seed_bulk_profile_ranks;
  IF v_profile_count < 2 THEN
    RAISE EXCEPTION 'Servono almeno 2 utenti in users_domain.profiles per generare recensioni incrociate (trovati: %).', v_profile_count;
  END IF;

  FOR v_listing IN
    SELECT l.id AS listing_id, l.owner_id, l.price_per_day_cents, l.deposit_cents,
           ROW_NUMBER() OVER (ORDER BY l.created_at, l.id) AS rn
    FROM inventory_domain.listings l
    WHERE l.is_active = true
    ORDER BY l.created_at, l.id
  LOOP
    SELECT rn INTO v_owner_rn FROM seed_bulk_profile_ranks WHERE id = v_listing.owner_id;
    IF v_owner_rn IS NULL THEN
      -- Owner isn't in the active profile set (e.g. soft-deleted) - nothing sane to pair it with.
      CONTINUE;
    END IF;

    SELECT COUNT(*) INTO v_existing_orders
      FROM rentals_domain.rental_items
     WHERE listing_id = v_listing.listing_id;

    v_need := v_target_orders_per_listing - v_existing_orders;
    IF v_need <= 0 THEN
      CONTINUE;
    END IF;

    SELECT (account_type = 'business') INTO v_lender_is_business
      FROM users_domain.profiles WHERE id = v_listing.owner_id;
    v_context := CASE WHEN v_lender_is_business THEN 'ferramenta' ELSE 'p2p' END;

    -- rental_items has a "no_double_booking" exclusion constraint on (listing_id, rental_period)
    -- for any non-cancelled/unavailable row (migration 000), so new bookings for this listing must
    -- not overlap each other OR whatever 001 (or a real booking) already put on it. Anchor the
    -- first new booking safely before the earliest existing one (defaulting to a few days ago if
    -- there isn't one / it's in the future), then walk each subsequent booking further into the
    -- past with a gap, inside the loop below.
    SELECT MIN(start_date) INTO v_earliest_existing_start
      FROM rentals_domain.rental_items
     WHERE listing_id = v_listing.listing_id
       AND status NOT IN ('cancelled', 'unavailable');

    v_days_ago_cursor := GREATEST(
      3,
      CASE WHEN v_earliest_existing_start IS NULL THEN 3
           ELSE (CURRENT_DATE - v_earliest_existing_start) + 5
      END
    );

    FOR j IN 1..v_need LOOP
      v_renter_rn := ((v_owner_rn - 1 + v_existing_orders + j) % v_profile_count) + 1;
      SELECT id INTO v_renter_id FROM seed_bulk_profile_ranks WHERE rn = v_renter_rn;

      IF v_renter_id = v_listing.owner_id THEN
        -- Round-robin landed back on the owner itself (small profile counts) - shift by one to
        -- the next distinct profile instead of skipping the iteration.
        v_renter_rn := (v_renter_rn % v_profile_count) + 1;
        SELECT id INTO v_renter_id FROM seed_bulk_profile_ranks WHERE rn = v_renter_rn;
      END IF;

      IF v_renter_id IS NULL OR v_renter_id = v_listing.owner_id THEN
        CONTINUE;
      END IF;

      v_idx := v_listing.rn + v_existing_orders + j;
      v_total_days := 1 + (v_idx % 5); -- 1..5 days

      -- Walk backward from v_days_ago_cursor (already past every existing booking on this
      -- listing) so each new booking's [start_date, end_date] stays disjoint from the previous
      -- one too - see the no_double_booking note above. Only the most recent (j=1, smallest
      -- v_completed_days_ago) is guaranteed inside reviews_domain.can_submit_review's 14-day
      -- window; older ones on a listing with several extra bookings can land further back than
      -- that, which is fine since this INSERT runs directly and isn't going through that RLS
      -- policy/window check.
      v_completed_days_ago := v_days_ago_cursor;
      v_handed_over_days_ago := v_completed_days_ago + v_total_days;
      v_created_days_ago := v_handed_over_days_ago + 2;
      v_days_ago_cursor := v_handed_over_days_ago + 3; -- gap before the next (older) booking

      v_subtotal := v_listing.price_per_day_cents * v_total_days;
      v_service_fee := ROUND(v_subtotal * 0.10);
      v_grand_total := v_subtotal + COALESCE(v_listing.deposit_cents, 0);

      INSERT INTO rentals_domain.rental_orders
        (renter_id, status, subtotal_cents, service_fee_cents, total_deposit_cents, grand_total_cents, currency_code, created_at, updated_at)
      VALUES (
        v_renter_id, 'completed'::rentals_domain.order_status, v_subtotal, v_service_fee,
        COALESCE(v_listing.deposit_cents, 0), v_grand_total, 'EUR',
        NOW() - (v_created_days_ago || ' days')::interval,
        NOW() - (v_completed_days_ago || ' days')::interval
      )
      RETURNING id INTO v_order_id;

      INSERT INTO rentals_domain.rental_items
        (order_id, listing_id, owner_id, start_date, end_date, daily_rate_cents, total_days,
         item_subtotal_cents, deposit_cents, status, handed_over_at, returned_at)
      VALUES (
        v_order_id, v_listing.listing_id, v_listing.owner_id,
        (NOW() - (v_handed_over_days_ago || ' days')::interval)::date,
        (NOW() - (v_completed_days_ago || ' days')::interval)::date,
        v_listing.price_per_day_cents, v_total_days, v_subtotal, COALESCE(v_listing.deposit_cents, 0),
        'returned_ok'::rentals_domain.rental_item_status,
        NOW() - (v_handed_over_days_ago || ' days')::interval,
        NOW() - (v_completed_days_ago || ' days')::interval
      );

      INSERT INTO rentals_domain.transactions
        (order_id, stripe_payment_intent_id, amount_cents, platform_fee_cents, currency_code, status)
      VALUES (
        v_order_id, 'pi_seed_bulk_' || v_order_id, v_grand_total, v_service_fee,
        'EUR', 'captured'::rentals_domain.payment_flow_status
      );

      v_rating_lender := (ARRAY[5, 4, 5, 4, 3])[(v_idx % 5) + 1];
      v_comment_lender := (ARRAY[
        'Noleggio perfetto, attrezzo in ottime condizioni e proprietario molto disponibile.',
        'Tutto secondo descrizione, ritiro e consegna facili.',
        'Buona esperienza, consiglio.',
        'Attrezzo funzionante, comunicazione rapida.',
        'Esperienza nella media, qualche piccolo ritardo nelle risposte.'
      ])[(v_idx % 5) + 1];
      -- Not a single ARRAY[...][...] index: sub-arrays here have different lengths (2/2/1/1/0
      -- elements), and Postgres multidimensional array literals require matching dimensions, so
      -- picking by CASE instead of array-of-arrays indexing.
      v_tags_lender := CASE v_idx % 5
        WHEN 0 THEN ARRAY['oggetto come descritto', 'consigliato']
        WHEN 1 THEN ARRAY['puntuale', 'disponibile']
        WHEN 2 THEN ARRAY['ottima comunicazione']
        WHEN 3 THEN ARRAY['consigliato']
        ELSE ARRAY[]::TEXT[]
      END;

      INSERT INTO reviews_domain.reviews
        (booking_id, author_user_id, target_user_id, target_role, context, overall_rating, comment, tags)
      VALUES (
        v_order_id, v_renter_id, v_listing.owner_id, 'lender', v_context,
        v_rating_lender, v_comment_lender, v_tags_lender
      );

      v_rating_renter := (ARRAY[5, 5, 4, 4, 3])[(v_idx % 5) + 1];
      v_comment_renter := (ARRAY[
        'Noleggiatore serio, riconsegna puntuale.',
        'Tutto ok, nessun problema durante il noleggio.',
        'Comunicazione chiara, attrezzo restituito pulito.',
        'Esperienza positiva, ripeterei volentieri.',
        'Va bene, piccola incomprensione sugli orari ma risolta.'
      ])[(v_idx % 5) + 1];
      v_tags_renter := CASE v_idx % 5
        WHEN 0 THEN ARRAY['puntuale alla riconsegna']
        WHEN 1 THEN ARRAY['nessun danno', 'consigliato']
        WHEN 2 THEN ARRAY['buona comunicazione']
        WHEN 3 THEN ARRAY['consigliato']
        ELSE ARRAY[]::TEXT[]
      END;

      -- Inserted right after the lender-direction row above so, for 'p2p' context, the
      -- apply_visibility_rules trigger sees the mirror already present and flips BOTH rows to
      -- visible immediately (see this file's header comment).
      INSERT INTO reviews_domain.reviews
        (booking_id, author_user_id, target_user_id, target_role, context, overall_rating, comment, tags)
      VALUES (
        v_order_id, v_listing.owner_id, v_renter_id, 'renter', v_context,
        v_rating_renter, v_comment_renter, v_tags_renter
      );

      v_orders_created := v_orders_created + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed completato: % nuove prenotazioni completate e recensite create.', v_orders_created;
END $$;

COMMIT;

-- Quick sanity check after running: visible review counts and average rating per role.
SELECT target_role, context, COUNT(*) AS reviews, COUNT(*) FILTER (WHERE visible) AS visible_reviews
FROM reviews_domain.reviews
GROUP BY target_role, context
ORDER BY target_role, context;
