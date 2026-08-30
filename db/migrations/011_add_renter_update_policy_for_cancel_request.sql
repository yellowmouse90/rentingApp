-- rentals_domain.rental_orders and rental_items only ever had an owner-side UPDATE policy
-- (rental_orders_owner_update_policy / rental_items_owner_update_policy, added by migration
-- 005) - there was never a renter-side UPDATE policy on either table.
--
-- /api/bookings/[id]/transition's "cancel_request" action is renter-only: the renter cancelling
-- their own still-pending request updates both rental_orders.status and rental_items.status to
-- "cancelled" using their own user-scoped Supabase client. Without a renter-facing UPDATE
-- policy, both updates are blocked by RLS - caught here (unlike the historical 003/005/006/007
-- bugs) because requireUpdate()/.select().single() were already in place, so this surfaced as a
-- loud 500 ("Impossibile aggiornare lo stato dell'ordine") instead of a silent no-op. Found by
-- tests/e2e/bookings/lifecycle.spec.ts against a database dumped straight from production - this
-- is a live bug, not a test-fixture artifact.
--
-- Scoped to pending/requested (the only states cancel_request's own application-level check
-- allows) so a renter can't use this policy to edit an order that has moved past that point.

DO $$
BEGIN
  CREATE POLICY rental_orders_renter_cancel_update_policy ON rentals_domain.rental_orders
    FOR UPDATE USING (
      auth.uid() = renter_id AND status = 'pending'
    )
    WITH CHECK (
      auth.uid() = renter_id
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'rental_orders_renter_cancel_update_policy already exists, skipping';
END $$;

DO $$
BEGIN
  CREATE POLICY rental_items_renter_cancel_update_policy ON rentals_domain.rental_items
    FOR UPDATE USING (
      status = 'requested' AND EXISTS (
        SELECT 1 FROM rentals_domain.rental_orders
        WHERE rental_orders.id = rental_items.order_id
        AND rental_orders.renter_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM rentals_domain.rental_orders
        WHERE rental_orders.id = rental_items.order_id
        AND rental_orders.renter_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'rental_items_renter_cancel_update_policy already exists, skipping';
END $$;
