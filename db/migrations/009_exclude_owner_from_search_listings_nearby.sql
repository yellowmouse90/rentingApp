-- search_listings_nearby applied LIMIT/OFFSET before the caller's own listings were filtered
-- out (filtering happened client-side, after the page was already capped at page_limit rows).
-- Whenever one of the caller's own listings fell inside a page's raw offset window, that page
-- rendered with fewer than page_limit results (e.g. 49 instead of 50) even though more listings
-- existed. Add exclude_owner_id and apply it in the WHERE clause, before LIMIT/OFFSET, so pages
-- are filled correctly.

DROP FUNCTION IF EXISTS inventory_domain.search_listings_nearby(
  double precision, double precision, double precision, text, text, integer, integer, text, integer, integer
);

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
 RETURNS TABLE(id uuid, owner_id uuid, category_id uuid, title character varying, description text, condition inventory_domain.tool_condition, price_per_day_cents integer, price_per_week_cents integer, currency_code character, deposit_cents integer, item_location_name text, is_available boolean, views_count integer, created_at timestamp with time zone, distance_km double precision, owner_display_name character varying, owner_avatar_url text, owner_rating numeric, category_name character varying, category_icon character varying, first_image_url text)
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
        (SELECT li.image_url FROM inventory_domain.listing_images li WHERE li.listing_id = l.id ORDER BY li.display_order LIMIT 1) AS first_image_url
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

-- DROP FUNCTION removes any grants that existed on the old function signature; restore them
-- explicitly rather than relying on the default PUBLIC execute privilege.
GRANT EXECUTE ON FUNCTION inventory_domain.search_listings_nearby(
  double precision, double precision, double precision, text, text, integer, integer, text, integer, integer, uuid
) TO anon, authenticated;
