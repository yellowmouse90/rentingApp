-- Reviews Domain Schema for Pietro
--
-- Bidirectional, role-and-context-aware review system (see spec: Pietro -
-- Sistema di Recensioni). A completed booking (rentals_domain.rental_orders)
-- can generate up to two reviews - renter about lender, lender about renter
-- - kept as independent rows so a review is never blocked on its
-- counterpart being written. `target_role` says which side of the booking
-- the review is about ('lender' = chi presta l'attrezzo, 'renter' = chi lo
-- prende a noleggio); `context` says which channel the booking happened on
-- ('ferramenta' = hardware-store-as-lender, one-way publish; 'p2p' =
-- private-to-private, double-blind publish). The full schema is created
-- now even though only the ferramenta-lender flow is wired up in the UI
-- for phase 1, so enabling P2P later needs a UI/flag flip, not a schema
-- migration.
--
-- Follows the same per-domain-schema, explicit-grants, per-command-RLS-
-- policy conventions as notifications_domain (migration 008) - see that
-- file's header for the two gotchas (migrations 003/006) this pre-empts:
-- every RLS-protected command needs its own explicit policy (a missing one
-- silently blocks with 0 rows on UPDATE, though INSERT blocked by a
-- WITH CHECK does raise a real error), and custom schemas are NOT
-- auto-granted to service_role/anon/authenticated.

CREATE SCHEMA IF NOT EXISTS reviews_domain;

-- Minimal hook needed to tell a "ferramenta" (hardware store) lender apart
-- from a private one when deriving a review's `context` server-side (see
-- reviews_domain.can_submit_review below). Business-account features
-- themselves (inventory tooling, staff dashboards, etc.) are out of scope
-- for this migration - this column only exists to make review context
-- derivable without trusting the client.
ALTER TABLE users_domain.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (account_type IN ('individual', 'business'));

CREATE TABLE IF NOT EXISTS reviews_domain.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES rentals_domain.rental_orders(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL CHECK (target_role IN ('lender', 'renter')),
  context TEXT NOT NULL CHECK (context IN ('ferramenta', 'p2p')),
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  sub_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
  comment TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  visible BOOLEAN NOT NULL DEFAULT FALSE,
  visible_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT reviews_author_not_target CHECK (author_user_id <> target_user_id),
  CONSTRAINT reviews_unique_author_role_per_booking UNIQUE (booking_id, author_user_id, target_role)
);

CREATE INDEX IF NOT EXISTS idx_reviews_target
  ON reviews_domain.reviews(target_user_id, target_role, context, visible);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews_domain.reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_author ON reviews_domain.reviews(author_user_id);

-- Derived per-(user, role, context) aggregate, kept fresh by the trigger
-- below rather than as a materialized view - at current/expected review
-- volumes a per-write recompute is cheap and avoids refresh-lag, and it
-- sidesteps having to schedule a periodic REFRESH MATERIALIZED VIEW job on
-- top of the one already needed for visibility (see reveal-expired-reviews
-- cron route).
CREATE TABLE IF NOT EXISTS reviews_domain.user_rating_summaries (
  user_id UUID NOT NULL REFERENCES users_domain.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lender', 'renter')),
  context TEXT NOT NULL CHECK (context IN ('ferramenta', 'p2p')),
  average_rating NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  tag_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role, context)
);

-- Real authorization boundary for INSERT (see reviews_insert_policy below),
-- not just a backstop for the API route - PostgREST is reachable directly
-- with a user's own session, so the same rules the API route re-derives
-- for good error messages are enforced here too: booking must be
-- completed, still within the review window, author/target/role must
-- match the booking's actual participants, and context must match whether
-- the booking's lender is a business ("ferramenta") account.
CREATE OR REPLACE FUNCTION reviews_domain.can_submit_review(
  p_booking_id UUID,
  p_author_id UUID,
  p_target_id UUID,
  p_target_role TEXT,
  p_context TEXT
) RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, reviews_domain, rentals_domain, users_domain
AS $$
DECLARE
  v_order_status rentals_domain.order_status;
  v_order_updated_at TIMESTAMP WITH TIME ZONE;
  v_renter_id UUID;
  v_owner_id UUID;
  v_lender_is_business BOOLEAN;
BEGIN
  SELECT status, updated_at, renter_id
    INTO v_order_status, v_order_updated_at, v_renter_id
    FROM rentals_domain.rental_orders
   WHERE id = p_booking_id;

  IF NOT FOUND OR v_order_status IS DISTINCT FROM 'completed' THEN
    RETURN FALSE;
  END IF;

  IF v_order_updated_at < NOW() - INTERVAL '14 days' THEN
    RETURN FALSE;
  END IF;

  SELECT owner_id INTO v_owner_id
    FROM rentals_domain.rental_items
   WHERE order_id = p_booking_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT (account_type = 'business') INTO v_lender_is_business
    FROM users_domain.profiles
   WHERE id = v_owner_id;

  IF p_context <> (CASE WHEN v_lender_is_business THEN 'ferramenta' ELSE 'p2p' END) THEN
    RETURN FALSE;
  END IF;

  IF p_target_role = 'lender' THEN
    RETURN p_author_id = v_renter_id AND p_target_id = v_owner_id;
  ELSIF p_target_role = 'renter' THEN
    RETURN p_author_id = v_owner_id AND p_target_id = v_renter_id;
  END IF;

  RETURN FALSE;
END;
$$;

-- Visibility rules (spec sez. 4): ferramenta-context lender reviews publish
-- immediately (one-way, no retaliation risk since the ferramenta side of a
-- ferramenta-context booking never itself receives a public review - see
-- the target_role='renter' branch below). p2p reviews start hidden and
-- flip to visible, together with their counterpart, the moment both exist
-- for the same booking ("doppio cieco"); a lone p2p review is revealed on
-- its own by the reveal-expired-reviews cron job once the 14-day window
-- lapses (sez. 4, third bullet), not by this trigger.
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

CREATE TRIGGER reviews_before_insert_visibility
  BEFORE INSERT ON reviews_domain.reviews
  FOR EACH ROW EXECUTE FUNCTION reviews_domain.apply_visibility_rules();

-- Keeps user_rating_summaries (and, for backward compatibility, the
-- pre-existing per-role aggregate columns on profiles -
-- average_rating_as_owner/renter, total_reviews_as_owner/renter, already
-- read by app/users/[id]/page.tsx and inventory_domain.search_listings_nearby)
-- fresh after every insert/visibility change. lender -> "owner" columns,
-- renter -> "renter" columns; profiles columns aggregate across context
-- since phase 1 only ever has 'ferramenta' rows live for the 'lender' role
-- anyway.
CREATE OR REPLACE FUNCTION reviews_domain.refresh_rating_summary(
  p_user_id UUID, p_role TEXT, p_context TEXT
) RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, reviews_domain, users_domain
AS $$
DECLARE
  v_avg NUMERIC(2,1);
  v_count INTEGER;
  v_tags JSONB;
BEGIN
  SELECT COALESCE(ROUND(AVG(overall_rating)::numeric, 1), 0.0), COUNT(*)
    INTO v_avg, v_count
    FROM reviews_domain.reviews
   WHERE target_user_id = p_user_id AND target_role = p_role
     AND context = p_context AND visible = TRUE;

  SELECT COALESCE(jsonb_object_agg(tag, tag_count), '{}'::jsonb) INTO v_tags
    FROM (
      SELECT tag, COUNT(*) AS tag_count
        FROM reviews_domain.reviews r, unnest(r.tags) AS tag
       WHERE r.target_user_id = p_user_id AND r.target_role = p_role
         AND r.context = p_context AND r.visible = TRUE
       GROUP BY tag
    ) t;

  INSERT INTO reviews_domain.user_rating_summaries
    (user_id, role, context, average_rating, review_count, tag_frequency, updated_at)
  VALUES (p_user_id, p_role, p_context, v_avg, v_count, v_tags, NOW())
  ON CONFLICT (user_id, role, context) DO UPDATE
    SET average_rating = EXCLUDED.average_rating,
        review_count = EXCLUDED.review_count,
        tag_frequency = EXCLUDED.tag_frequency,
        updated_at = NOW();

  IF p_role = 'lender' THEN
    UPDATE users_domain.profiles
       SET average_rating_as_owner = (
             SELECT COALESCE(ROUND(AVG(overall_rating)::numeric, 1), 0.0)
               FROM reviews_domain.reviews
              WHERE target_user_id = p_user_id AND target_role = 'lender' AND visible = TRUE
           ),
           total_reviews_as_owner = (
             SELECT COUNT(*) FROM reviews_domain.reviews
              WHERE target_user_id = p_user_id AND target_role = 'lender' AND visible = TRUE
           )
     WHERE id = p_user_id;
  ELSE
    UPDATE users_domain.profiles
       SET average_rating_as_renter = (
             SELECT COALESCE(ROUND(AVG(overall_rating)::numeric, 1), 0.0)
               FROM reviews_domain.reviews
              WHERE target_user_id = p_user_id AND target_role = 'renter' AND visible = TRUE
           ),
           total_reviews_as_renter = (
             SELECT COUNT(*) FROM reviews_domain.reviews
              WHERE target_user_id = p_user_id AND target_role = 'renter' AND visible = TRUE
           )
     WHERE id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reviews_domain.reviews_after_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, reviews_domain
AS $$
BEGIN
  PERFORM reviews_domain.refresh_rating_summary(NEW.target_user_id, NEW.target_role, NEW.context);

  IF TG_OP = 'UPDATE' AND (
       OLD.target_user_id <> NEW.target_user_id
    OR OLD.target_role <> NEW.target_role
    OR OLD.context <> NEW.context
  ) THEN
    PERFORM reviews_domain.refresh_rating_summary(OLD.target_user_id, OLD.target_role, OLD.context);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reviews_after_write_trigger
  AFTER INSERT OR UPDATE ON reviews_domain.reviews
  FOR EACH ROW EXECUTE FUNCTION reviews_domain.reviews_after_write();

ALTER TABLE reviews_domain.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews_domain.user_rating_summaries ENABLE ROW LEVEL SECURITY;

-- Published reviews are public (profile pages, listing cards). An author
-- can always see their own row regardless of visibility so the UI can show
-- "hai già recensito" / "in attesa della controparte" - this never leaks
-- the counterpart's content, since the counterpart's row has a different
-- author_user_id and only becomes reachable through the visible=true
-- policy once published.
CREATE POLICY reviews_select_visible_policy ON reviews_domain.reviews
  FOR SELECT USING (visible = TRUE);

CREATE POLICY reviews_select_own_policy ON reviews_domain.reviews
  FOR SELECT USING (author_user_id = auth.uid());

CREATE POLICY reviews_insert_policy ON reviews_domain.reviews
  FOR INSERT WITH CHECK (
    author_user_id = auth.uid()
    AND reviews_domain.can_submit_review(booking_id, author_user_id, target_user_id, target_role, context)
  );

-- Summaries are derived, public read-only data - only the triggers above
-- (running as the function owner via SECURITY DEFINER) ever write them, so
-- there is deliberately no INSERT/UPDATE policy for authenticated/anon,
-- same reasoning as notifications_domain.notifications.
CREATE POLICY user_rating_summaries_select_policy ON reviews_domain.user_rating_summaries
  FOR SELECT USING (TRUE);

-- service_role needs explicit schema/table grants for custom schemas (see
-- migration 006's header comment for the full explanation of why), and the
-- reveal-expired-reviews cron route runs as the admin client.
DO $$
BEGIN
  EXECUTE 'GRANT USAGE ON SCHEMA reviews_domain TO service_role';
  EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA reviews_domain TO service_role';
  EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA reviews_domain TO service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA reviews_domain GRANT ALL ON TABLES TO service_role';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA reviews_domain GRANT ALL ON SEQUENCES TO service_role';
END $$;

-- Base grants so PostgREST can reach the RLS-gated policies above for the
-- anon/authenticated roles (mirrors how the other custom schemas work).
GRANT USAGE ON SCHEMA reviews_domain TO authenticated, anon;
GRANT SELECT, INSERT ON reviews_domain.reviews TO authenticated;
GRANT SELECT ON reviews_domain.reviews TO anon;
GRANT SELECT ON reviews_domain.user_rating_summaries TO authenticated, anon;
