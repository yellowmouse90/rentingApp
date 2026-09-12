-- The listing detail page's booking calendar (components/listings/booking-card.tsx) shows a date
-- as unavailable by reading rental_items rows for that listing directly through the user-scoped
-- client (app/listings/[id]/page.tsx). But rental_items_select_policy (000_baseline.sql) only lets
-- the item's owner or the order's renter SELECT a row - so any other visitor browsing the listing
-- (the common case: someone deciding whether to book) gets zero rows back with no error, and the
-- calendar renders every day as free even when the tool is booked solid. Same silent-RLS-no-op
-- failure mode as migrations 003/005/006/007, just on a read this time instead of a write.
--
-- Widening rental_items_select_policy itself would leak other renters' pricing/deposit/notes to
-- every visitor. Instead, expose only the three columns the calendar actually needs through a
-- SECURITY DEFINER function - same pattern already used for inventory_domain.search_listings_nearby
-- to read across RLS boundaries in a controlled way.
create or replace function rentals_domain.get_listing_availability(p_listing_id uuid)
returns table (start_date date, end_date date, status rentals_domain.rental_item_status)
language plpgsql security definer
set search_path to 'rentals_domain'
as $$
begin
  return query
  select ri.start_date, ri.end_date, ri.status
  from rentals_domain.rental_items ri
  where ri.listing_id = p_listing_id
    and ri.status not in ('cancelled', 'unavailable');
end;
$$;

grant execute on function rentals_domain.get_listing_availability(uuid) to anon, authenticated;
