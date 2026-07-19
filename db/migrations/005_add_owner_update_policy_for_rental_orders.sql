-- The item owner accepts/rejects/handovers/closes rentals via
-- /api/bookings/[id]/transition, which runs UPDATE rentals_domain.rental_orders
-- and UPDATE rentals_domain.rental_items with the *user-scoped* Supabase client
-- (RLS applies, unlike the admin client used by the Stripe webhook).
--
-- rental_orders only carries renter_id, and (per the existing comment in
-- components/bookings/booking-form.tsx) only the renter has an UPDATE policy
-- on it. So when the OWNER calls "accept"/"reject"/"confirm_handover"/
-- "mark_returned_ok"/"report_damage", the update to rental_orders.status is
-- silently blocked by RLS: 0 rows affected, no Postgres error, and the API
-- route used to return { ok: true } anyway because it never checked how many
-- rows were touched. From the UI this looks exactly like "click accetta,
-- nothing happens" - the request "succeeds" but the order status never moves.
--
-- This adds the missing owner-side UPDATE policy for rental_orders (owner
-- identified via the linked rental_items row), and, defensively, the
-- equivalent for rental_items in case that one has the same gap. Wrapped in
-- DO blocks so re-running this after a policy of the same name already
-- exists is a no-op instead of an error.

DO $$
BEGIN
  CREATE POLICY rental_orders_owner_update_policy ON rentals_domain.rental_orders
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM rentals_domain.rental_items
        WHERE rental_items.order_id = rental_orders.id
        AND rental_items.owner_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM rentals_domain.rental_items
        WHERE rental_items.order_id = rental_orders.id
        AND rental_items.owner_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'rental_orders_owner_update_policy already exists, skipping';
END $$;

DO $$
BEGIN
  CREATE POLICY rental_items_owner_update_policy ON rentals_domain.rental_items
    FOR UPDATE USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'rental_items_owner_update_policy already exists, skipping';
END $$;
