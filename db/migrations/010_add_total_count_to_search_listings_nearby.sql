-- The client only ever knew how many listings it had *loaded so far* (it summed page sizes),
-- so "Trovati 50 oggetti" understated the real match count until the user scrolled further.
-- Add total_count via COUNT(*) OVER(): Postgres evaluates window functions over the full
-- filtered result set before ORDER BY/LIMIT/OFFSET are applied, so every row in a page carries
-- the true total for the current filters (including exclude_owner_id) in a single query.

-- Drop whatever signature currently exists (rather than hardcoding the pre-migration one) so
-- this stays replayable regardless of starting state - e.g. against a freshly-dumped baseline
-- that already has this signature (see db/migrations/000_baseline.sql).
DO $$
DECLARE
  sig text;
BEGIN
  FOR sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'inventory_domain' AND p.proname = 'search_listings_nearby'
  LOOP
    EXECUTE format('DROP FUNCTION %s', sig);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION inventory_domain.search_listings_nearby(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision DEFAULT 50,
  category_slug text DEFAULT NULL::text,
  search_query text DEFAULT NULL::text,
  min_price integer DEFAULT NULL::integer,
  max_price integer DEFAULT NULL::integer,
  item_condition text DEFAULT NULL::text,
  page_limit integer DEFAULT 20,
  page_offset integer DEFAULT 0,
  exclude_owner_id uuid DEFAULT NULL::uuid
)
 RETURNS TABLE(id uuid, owner_id uuid, category_id uuid, title character varying, description text, condition inventory_domain.tool_condition, price_per_day_cents integer, price_per_week_cents integer, currency_code character, deposit_cents integer, item_location_name text, is_available boolean, views_count integer, created_at timestamp with time zone, distance_km double precision, owner_display_name character varying, owner_avatar_url text, owner_rating numeric, category_name character varying, category_icon character varying, first_image_url text, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.owner_id,
        l.category_id,
        l.title,
        l.description,
        l.condition,
        l.price_per_day_cents,
        l.price_per_week_cents,
        l.currency_code,
        l.deposit_cents,
        l.item_location_name,
        l.is_available,
        l.views_count,
        l.created_at,
        ROUND((ST_Distance(l.item_coords, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 1000)::numeric, 2)::double precision AS distance_km,
        p.display_name AS owner_display_name,
        p.avatar_url AS owner_avatar_url,
        p.average_rating_as_owner AS owner_rating,
        c.name AS category_name,
        c.icon_name AS category_icon,
        (SELECT li.image_url FROM inventory_domain.listing_images li WHERE li.listing_id = l.id ORDER BY li.display_order LIMIT 1) AS first_image_url,
        COUNT(*) OVER()::bigint AS total_count
    FROM inventory_domain.listings l
    LEFT JOIN users_domain.profiles p ON l.owner_id = p.id
    LEFT JOIN inventory_domain.categories c ON l.category_id = c.id
    WHERE l.is_active = true
      AND l.is_available = true
      AND l.item_coords IS NOT NULL
      AND ST_DWithin(l.item_coords, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_km * 1000)
      AND (category_slug IS NULL OR c.slug = category_slug)
      AND (search_query IS NULL OR l.title ILIKE '%' || search_query || '%' OR l.description ILIKE '%' || search_query || '%')
      AND (min_price IS NULL OR l.price_per_day_cents >= min_price)
      AND (max_price IS NULL OR l.price_per_day_cents <= max_price)
      AND (item_condition IS NULL OR l.condition::text = item_condition)
      AND (exclude_owner_id IS NULL OR l.owner_id IS DISTINCT FROM exclude_owner_id)
    ORDER BY distance_km ASC
    LIMIT page_limit
    OFFSET page_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION inventory_domain.search_listings_nearby(
  double precision, double precision, double precision, text, text, integer, integer, text, integer, integer, uuid
) TO anon, authenticated;
