-- Account deletion (DELETE /api/account) moves from a hard delete (removing the
-- auth.users row, which cascaded through profiles -> listings/rental_items/rental_orders/
-- addresses/payment methods) to a soft delete: the profile row - and, critically, every
-- completed rental_orders/rental_items/transactions row it's a party to - stays in place
-- as an audit trail. The route instead scrubs personal data on the profile, marks it
-- deleted_at, and soft-deletes the corresponding auth.users row (which purges sessions/
-- refresh tokens and blocks login, per Supabase's admin.deleteUser(id, true)).
--
-- No RLS/grant changes needed: profiles_update_own (auth.uid() = id) already lets a user
-- update every column on their own row, including the ones this scrub touches.
ALTER TABLE users_domain.profiles
  ADD COLUMN deleted_at timestamptz;

-- Partial index: only deleted rows are ever filtered on this column, and this table is
-- read far more often than the (small, rare) set of deleted accounts.
CREATE INDEX idx_profiles_deleted_at ON users_domain.profiles (deleted_at) WHERE deleted_at IS NOT NULL;
