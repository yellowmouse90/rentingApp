-- rentals_domain.transactions only had a SELECT policy for the renter
-- (transactions_select_own: rental_orders.renter_id = auth.uid()) and no
-- policy at all for the owner, and no UPDATE policy for anyone.
--
-- /api/bookings/[id]/transition's "mark_returned_ok" action is an owner-only
-- action that (a) looks up the authorized transaction for the order before
-- capturing the PaymentIntent, and (b) updates that same row to "captured"
-- afterwards - both using the owner's own user-scoped Supabase client. With
-- no owner-facing policy, the SELECT silently returned 0 rows even though
-- the transaction existed, surfacing to the owner as "Transazione
-- autorizzata non trovata"; the later UPDATE would have failed the same way.
--
-- Reuses the existing rentals_domain.bypass_is_order_owner(order_uuid,
-- user_uuid) SECURITY DEFINER helper, already used by rental_orders/
-- rental_items policies, for consistency.

CREATE POLICY transactions_owner_select_policy ON rentals_domain.transactions
  FOR SELECT USING (
    rentals_domain.bypass_is_order_owner(order_id, auth.uid())
  );

CREATE POLICY transactions_owner_update_policy ON rentals_domain.transactions
  FOR UPDATE USING (
    rentals_domain.bypass_is_order_owner(order_id, auth.uid())
  )
  WITH CHECK (
    rentals_domain.bypass_is_order_owner(order_id, auth.uid())
  );
