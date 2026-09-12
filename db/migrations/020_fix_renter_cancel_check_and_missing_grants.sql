-- Two independent fixes found in a full-codebase audit:
--
-- 1. Security: migration 011's renter-cancel UPDATE policies on
--    rental_orders/rental_items constrain which EXISTING rows a renter may
--    touch (USING: only their own still-pending order) but never constrain
--    the RESULTING row (WITH CHECK only re-checks ownership, not the new
--    status). Since PostgREST is reachable directly with the caller's own
--    session (same caveat as reviews_domain.can_submit_review), a renter
--    could bypass /api/bookings/[id]/transition entirely and PATCH their
--    own still-pending, unpaid order straight to "completed"/"paid"/etc,
--    which unlocks review submission (reviews_domain.can_submit_review only
--    checks status = 'completed' and the 14-day window) without ever paying
--    or going through owner acceptance/handover. Fixed by constraining
--    WITH CHECK to the one resulting status this policy is meant to allow.
--
-- 2. Grants: users_domain was never granted USAGE to `anon`, despite
--    granting table-level SELECT on profiles to `anon` (baseline migration)
--    - an internally inconsistent grant set, since schema-level USAGE is a
--    prerequisite Postgres checks before any table privilege applies. This
--    404s app/users/[id]/page.tsx (a deliberately public profile page, not
--    in middleware's protected-path list) with PGRST106/42501 for every
--    signed-out visitor. app/listings/[id]/page.tsx already works around
--    the identical gap with an admin-client fallback (see its comments) -
--    this fixes it at the source instead.
--
--    interactions_domain (migration 001) never granted USAGE/table
--    privileges to anon/authenticated at all - migration 006 only
--    back-filled service_role. Chat evidently works in production, so
--    these grants exist on the hosted project but were applied out-of-band
--    and never captured in db/migrations/; recorded here so replaying
--    000->latest against a fresh database doesn't leave chat broken with
--    42501 for every authenticated request. Additive/idempotent, safe to
--    re-run even where the grant already exists out-of-band.

DROP POLICY IF EXISTS rental_orders_renter_cancel_update_policy ON rentals_domain.rental_orders;
CREATE POLICY rental_orders_renter_cancel_update_policy ON rentals_domain.rental_orders
  FOR UPDATE USING (
    auth.uid() = renter_id AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = renter_id AND status = 'cancelled'
  );

DROP POLICY IF EXISTS rental_items_renter_cancel_update_policy ON rentals_domain.rental_items;
CREATE POLICY rental_items_renter_cancel_update_policy ON rentals_domain.rental_items
  FOR UPDATE USING (
    status = 'requested' AND EXISTS (
      SELECT 1 FROM rentals_domain.rental_orders
      WHERE rental_orders.id = rental_items.order_id
      AND rental_orders.renter_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled' AND EXISTS (
      SELECT 1 FROM rentals_domain.rental_orders
      WHERE rental_orders.id = rental_items.order_id
      AND rental_orders.renter_id = auth.uid()
    )
  );

GRANT USAGE ON SCHEMA users_domain TO anon;

DO $$
BEGIN
  EXECUTE 'GRANT USAGE ON SCHEMA interactions_domain TO anon, authenticated';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON interactions_domain.conversations TO anon, authenticated';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ON interactions_domain.messages TO anon, authenticated';
END $$;
