-- Baseline schema for users_domain / inventory_domain / rentals_domain.
--
-- Unlike every other file in this directory, this one was NOT written by hand: it's a
-- `supabase db dump --schema users_domain,inventory_domain,rentals_domain` capture of the
-- production project (ddosczkxolgphqgxjreh) taken on 2026-08-30. These three schemas predate
-- this migrations folder entirely (001 already assumes users_domain.profiles exists) and were
-- created directly against the live project, so there was previously no SQL anywhere that could
-- reconstruct them. This file is that missing starting point; 001-010 apply cleanly on top of it.
--
-- Extensions the dumped schema depends on (postgis for the `geography` columns/GiST location
-- indexes, btree_gist for the no-double-booking EXCLUDE constraint on rental_items) are not part
-- of the dump itself, since `supabase db dump --schema` only captures the named schemas. Local
-- Supabase (`supabase start`) already provides uuid-ossp/pgcrypto/pg_stat_statements.
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "inventory_domain";


ALTER SCHEMA "inventory_domain" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "rentals_domain";


ALTER SCHEMA "rentals_domain" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "users_domain";


ALTER SCHEMA "users_domain" OWNER TO "postgres";


CREATE TYPE "inventory_domain"."tool_condition" AS ENUM (
    'new',
    'like_new',
    'good',
    'fair'
);


ALTER TYPE "inventory_domain"."tool_condition" OWNER TO "postgres";


CREATE TYPE "rentals_domain"."order_status" AS ENUM (
    'pending',
    'approved',
    'ongoing',
    'completed',
    'cancelled',
    'disputed',
    'accepted',
    'paid',
    'in_progress'
);


ALTER TYPE "rentals_domain"."order_status" OWNER TO "postgres";


CREATE TYPE "rentals_domain"."payment_flow_status" AS ENUM (
    'authorized',
    'captured',
    'released_to_seller',
    'refunded',
    'failed',
    'requires_payment_method',
    'released'
);


ALTER TYPE "rentals_domain"."payment_flow_status" OWNER TO "postgres";


CREATE TYPE "rentals_domain"."rental_item_status" AS ENUM (
    'requested',
    'approved',
    'ongoing',
    'completed',
    'cancelled',
    'disputed',
    'unavailable',
    'accepted',
    'paid',
    'collected',
    'returned_ok',
    'damaged'
);


ALTER TYPE "rentals_domain"."rental_item_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "inventory_domain"."search_listings_nearby"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision DEFAULT 50, "category_slug" "text" DEFAULT NULL::"text", "search_query" "text" DEFAULT NULL::"text", "min_price" integer DEFAULT NULL::integer, "max_price" integer DEFAULT NULL::integer, "item_condition" "text" DEFAULT NULL::"text", "page_limit" integer DEFAULT 20, "page_offset" integer DEFAULT 0, "exclude_owner_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "owner_id" "uuid", "category_id" "uuid", "title" character varying, "description" "text", "condition" "inventory_domain"."tool_condition", "price_per_day_cents" integer, "price_per_week_cents" integer, "currency_code" character, "deposit_cents" integer, "item_location_name" "text", "is_available" boolean, "views_count" integer, "created_at" timestamp with time zone, "distance_km" double precision, "owner_display_name" character varying, "owner_avatar_url" "text", "owner_rating" numeric, "category_name" character varying, "category_icon" character varying, "first_image_url" "text", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "inventory_domain"."search_listings_nearby"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision, "category_slug" "text", "search_query" "text", "min_price" integer, "max_price" integer, "item_condition" "text", "page_limit" integer, "page_offset" integer, "exclude_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "rentals_domain"."bypass_is_order_owner"("order_uuid" "uuid", "user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'rentals_domain'
    AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM rentals_domain.rental_items WHERE order_id = order_uuid AND owner_id = user_uuid);
END;
$$;


ALTER FUNCTION "rentals_domain"."bypass_is_order_owner"("order_uuid" "uuid", "user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "rentals_domain"."bypass_is_order_renter"("order_uuid" "uuid", "user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'rentals_domain'
    AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM rentals_domain.rental_orders WHERE id = order_uuid AND renter_id = user_uuid);
END;
$$;


ALTER FUNCTION "rentals_domain"."bypass_is_order_renter"("order_uuid" "uuid", "user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "rentals_domain"."check_order_renter"("order_uuid" "uuid", "user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'rentals_domain'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM rentals_domain.rental_orders 
    WHERE id = order_uuid AND renter_id = user_uuid
  );
END;
$$;


ALTER FUNCTION "rentals_domain"."check_order_renter"("order_uuid" "uuid", "user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "users_domain"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'users_domain'
    AS $$
BEGIN
  INSERT INTO users_domain.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "users_domain"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "inventory_domain"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "icon_name" character varying(50),
    "parent_id" "uuid"
);


ALTER TABLE "inventory_domain"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "inventory_domain"."category_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "language_code" character(2) NOT NULL,
    "name" character varying(100) NOT NULL
);


ALTER TABLE "inventory_domain"."category_translations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "inventory_domain"."listing_availability_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "unavailable_date" "date" NOT NULL,
    "reason" character varying(100)
);


ALTER TABLE "inventory_domain"."listing_availability_exceptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "inventory_domain"."listing_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "display_order" smallint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "inventory_domain"."listing_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "inventory_domain"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "title" character varying(150) NOT NULL,
    "description" "text",
    "condition" "inventory_domain"."tool_condition" NOT NULL,
    "price_per_day_cents" integer NOT NULL,
    "price_per_week_cents" integer,
    "currency_code" character(3) DEFAULT 'EUR'::"bpchar",
    "deposit_cents" integer DEFAULT 0,
    "location_address_id" "uuid",
    "latitude" numeric(9,6),
    "longitude" numeric(9,6),
    "is_available" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "views_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "item_coords" "public"."geography"(Point,4326),
    "item_location_name" "text",
    CONSTRAINT "listings_deposit_cents_check" CHECK (("deposit_cents" >= 0)),
    CONSTRAINT "listings_price_per_day_cents_check" CHECK (("price_per_day_cents" > 0)),
    CONSTRAINT "listings_price_per_week_cents_check" CHECK (("price_per_week_cents" > 0))
);


ALTER TABLE "inventory_domain"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "rentals_domain"."rental_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "rental_period" "daterange" GENERATED ALWAYS AS ("daterange"("start_date", "end_date", '[]'::"text")) STORED,
    "daily_rate_cents" integer NOT NULL,
    "total_days" integer NOT NULL,
    "item_subtotal_cents" integer NOT NULL,
    "deposit_cents" integer DEFAULT 0,
    "status" "rentals_domain"."rental_item_status" DEFAULT 'requested'::"rentals_domain"."rental_item_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "handed_over_at" timestamp with time zone,
    "returned_at" timestamp with time zone,
    "condition_notes" "text",
    "dispute_opened_at" timestamp with time zone,
    CONSTRAINT "rental_items_daily_rate_cents_check" CHECK (("daily_rate_cents" > 0)),
    CONSTRAINT "rental_items_deposit_cents_check" CHECK (("deposit_cents" >= 0)),
    CONSTRAINT "rental_items_item_subtotal_cents_check" CHECK (("item_subtotal_cents" > 0)),
    CONSTRAINT "rental_items_total_days_check" CHECK (("total_days" > 0)),
    CONSTRAINT "valid_dates" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "rentals_domain"."rental_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "rentals_domain"."rental_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "renter_id" "uuid" NOT NULL,
    "status" "rentals_domain"."order_status" DEFAULT 'pending'::"rentals_domain"."order_status",
    "subtotal_cents" integer NOT NULL,
    "service_fee_cents" integer DEFAULT 0,
    "total_deposit_cents" integer DEFAULT 0,
    "grand_total_cents" integer NOT NULL,
    "currency_code" character(3) DEFAULT 'EUR'::"bpchar",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rental_orders_grand_total_cents_check" CHECK (("grand_total_cents" >= 0)),
    CONSTRAINT "rental_orders_service_fee_cents_check" CHECK (("service_fee_cents" >= 0)),
    CONSTRAINT "rental_orders_subtotal_cents_check" CHECK (("subtotal_cents" >= 0)),
    CONSTRAINT "rental_orders_total_deposit_cents_check" CHECK (("total_deposit_cents" >= 0))
);


ALTER TABLE "rentals_domain"."rental_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "rentals_domain"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" character varying(255),
    "stripe_transfer_id" character varying(255),
    "amount_cents" integer NOT NULL,
    "platform_fee_cents" integer DEFAULT 0,
    "currency_code" character(3) DEFAULT 'EUR'::"bpchar",
    "status" "rentals_domain"."payment_flow_status" DEFAULT 'authorized'::"rentals_domain"."payment_flow_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transactions_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "transactions_platform_fee_cents_check" CHECK (("platform_fee_cents" >= 0))
);


ALTER TABLE "rentals_domain"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "users_domain"."currencies" (
    "code" character(3) NOT NULL,
    "name" character varying(50) NOT NULL,
    "symbol" character varying(5) NOT NULL
);


ALTER TABLE "users_domain"."currencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "users_domain"."languages" (
    "code" character(2) NOT NULL,
    "name" character varying(50) NOT NULL,
    "native_name" character varying(50) NOT NULL,
    "is_default" boolean DEFAULT false
);


ALTER TABLE "users_domain"."languages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "users_domain"."profiles" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "display_name" character varying(100),
    "avatar_url" "text",
    "bio" "text",
    "phone" character varying(20),
    "is_verified" boolean DEFAULT false,
    "preferred_currency" character(3) DEFAULT 'EUR'::"bpchar",
    "stripe_customer_id" character varying(255),
    "stripe_account_id" character varying(255),
    "stripe_onboarding_complete" boolean DEFAULT false,
    "average_rating_as_owner" numeric(2,1) DEFAULT 0.0,
    "average_rating_as_renter" numeric(2,1) DEFAULT 0.0,
    "total_reviews_as_owner" integer DEFAULT 0,
    "total_reviews_as_renter" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "location_coords" "public"."geography"(Point,4326),
    "location_name" "text"
);


ALTER TABLE "users_domain"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "users_domain"."user_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" character varying(50),
    "street_address" "text" NOT NULL,
    "city" character varying(100) NOT NULL,
    "postal_code" character varying(20),
    "region" character varying(100),
    "country_code" character(2) NOT NULL,
    "latitude" numeric(9,6),
    "longitude" numeric(9,6),
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "users_domain"."user_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "users_domain"."user_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_payment_method_id" character varying(255) NOT NULL,
    "card_brand" character varying(20),
    "card_last4" character(4),
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "users_domain"."user_payment_methods" OWNER TO "postgres";


ALTER TABLE ONLY "inventory_domain"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "inventory_domain"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "inventory_domain"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "inventory_domain"."category_translations"
    ADD CONSTRAINT "category_translations_category_id_language_code_key" UNIQUE ("category_id", "language_code");



ALTER TABLE ONLY "inventory_domain"."category_translations"
    ADD CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "inventory_domain"."listing_availability_exceptions"
    ADD CONSTRAINT "listing_availability_exceptions_listing_id_unavailable_date_key" UNIQUE ("listing_id", "unavailable_date");



ALTER TABLE ONLY "inventory_domain"."listing_availability_exceptions"
    ADD CONSTRAINT "listing_availability_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "inventory_domain"."listing_images"
    ADD CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "inventory_domain"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "rentals_domain"."rental_items"
    ADD CONSTRAINT "no_double_booking" EXCLUDE USING "gist" ("listing_id" WITH =, "rental_period" WITH &&) WHERE (("status" <> ALL (ARRAY['cancelled'::"rentals_domain"."rental_item_status", 'unavailable'::"rentals_domain"."rental_item_status"])));



ALTER TABLE ONLY "rentals_domain"."rental_items"
    ADD CONSTRAINT "rental_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "rentals_domain"."rental_orders"
    ADD CONSTRAINT "rental_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "rentals_domain"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "rentals_domain"."transactions"
    ADD CONSTRAINT "transactions_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "users_domain"."currencies"
    ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "users_domain"."languages"
    ADD CONSTRAINT "languages_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "users_domain"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "users_domain"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "users_domain"."profiles"
    ADD CONSTRAINT "profiles_stripe_account_id_key" UNIQUE ("stripe_account_id");



ALTER TABLE ONLY "users_domain"."profiles"
    ADD CONSTRAINT "profiles_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "users_domain"."user_addresses"
    ADD CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "users_domain"."user_payment_methods"
    ADD CONSTRAINT "user_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "users_domain"."user_payment_methods"
    ADD CONSTRAINT "user_payment_methods_stripe_payment_method_id_key" UNIQUE ("stripe_payment_method_id");



CREATE INDEX "idx_category_translations_category" ON "inventory_domain"."category_translations" USING "btree" ("category_id");



CREATE INDEX "idx_category_translations_lang" ON "inventory_domain"."category_translations" USING "btree" ("language_code");



CREATE INDEX "idx_listing_images_listing" ON "inventory_domain"."listing_images" USING "btree" ("listing_id");



CREATE INDEX "idx_listings_active" ON "inventory_domain"."listings" USING "btree" ("is_active", "is_available");



CREATE INDEX "idx_listings_category" ON "inventory_domain"."listings" USING "btree" ("category_id");



CREATE INDEX "idx_listings_location" ON "inventory_domain"."listings" USING "gist" ("item_coords");



CREATE INDEX "idx_listings_owner" ON "inventory_domain"."listings" USING "btree" ("owner_id");



CREATE INDEX "idx_rental_items_dates" ON "rentals_domain"."rental_items" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_rental_items_listing" ON "rentals_domain"."rental_items" USING "btree" ("listing_id");



CREATE INDEX "idx_rental_items_order" ON "rentals_domain"."rental_items" USING "btree" ("order_id");



CREATE INDEX "idx_rental_items_owner" ON "rentals_domain"."rental_items" USING "btree" ("owner_id");



CREATE INDEX "idx_rental_orders_renter" ON "rentals_domain"."rental_orders" USING "btree" ("renter_id");



CREATE INDEX "idx_rental_orders_status" ON "rentals_domain"."rental_orders" USING "btree" ("status");



CREATE INDEX "idx_transactions_order" ON "rentals_domain"."transactions" USING "btree" ("order_id");



CREATE INDEX "idx_profiles_location" ON "users_domain"."profiles" USING "gist" ("location_coords");



ALTER TABLE ONLY "inventory_domain"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "inventory_domain"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "inventory_domain"."category_translations"
    ADD CONSTRAINT "category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_domain"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "inventory_domain"."category_translations"
    ADD CONSTRAINT "category_translations_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "users_domain"."languages"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "inventory_domain"."listing_availability_exceptions"
    ADD CONSTRAINT "listing_availability_exceptions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "inventory_domain"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "inventory_domain"."listing_images"
    ADD CONSTRAINT "listing_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "inventory_domain"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "inventory_domain"."listings"
    ADD CONSTRAINT "listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_domain"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "inventory_domain"."listings"
    ADD CONSTRAINT "listings_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "users_domain"."currencies"("code");



ALTER TABLE ONLY "inventory_domain"."listings"
    ADD CONSTRAINT "listings_location_address_id_fkey" FOREIGN KEY ("location_address_id") REFERENCES "users_domain"."user_addresses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "inventory_domain"."listings"
    ADD CONSTRAINT "listings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users_domain"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "rentals_domain"."rental_items"
    ADD CONSTRAINT "rental_items_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "inventory_domain"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "rentals_domain"."rental_items"
    ADD CONSTRAINT "rental_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rentals_domain"."rental_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "rentals_domain"."rental_items"
    ADD CONSTRAINT "rental_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users_domain"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "rentals_domain"."rental_orders"
    ADD CONSTRAINT "rental_orders_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "users_domain"."currencies"("code");



ALTER TABLE ONLY "rentals_domain"."rental_orders"
    ADD CONSTRAINT "rental_orders_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "users_domain"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "rentals_domain"."transactions"
    ADD CONSTRAINT "transactions_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "users_domain"."currencies"("code");



ALTER TABLE ONLY "rentals_domain"."transactions"
    ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rentals_domain"."rental_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "users_domain"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "users_domain"."profiles"
    ADD CONSTRAINT "profiles_preferred_currency_fkey" FOREIGN KEY ("preferred_currency") REFERENCES "users_domain"."currencies"("code");



ALTER TABLE ONLY "users_domain"."user_addresses"
    ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users_domain"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "users_domain"."user_payment_methods"
    ADD CONSTRAINT "user_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users_domain"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "availability_delete_own" ON "inventory_domain"."listing_availability_exceptions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "inventory_domain"."listings"
  WHERE (("listings"."id" = "listing_availability_exceptions"."listing_id") AND ("listings"."owner_id" = "auth"."uid"())))));



CREATE POLICY "availability_insert_own" ON "inventory_domain"."listing_availability_exceptions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "inventory_domain"."listings"
  WHERE (("listings"."id" = "listing_availability_exceptions"."listing_id") AND ("listings"."owner_id" = "auth"."uid"())))));



CREATE POLICY "availability_select_all" ON "inventory_domain"."listing_availability_exceptions" FOR SELECT USING (true);



CREATE POLICY "availability_update_own" ON "inventory_domain"."listing_availability_exceptions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "inventory_domain"."listings"
  WHERE (("listings"."id" = "listing_availability_exceptions"."listing_id") AND ("listings"."owner_id" = "auth"."uid"())))));



CREATE POLICY "categories_select_all" ON "inventory_domain"."categories" FOR SELECT USING (true);



ALTER TABLE "inventory_domain"."category_translations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "category_translations_select_all" ON "inventory_domain"."category_translations" FOR SELECT USING (true);



ALTER TABLE "inventory_domain"."listing_availability_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "inventory_domain"."listing_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "listing_images_delete_own" ON "inventory_domain"."listing_images" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "inventory_domain"."listings"
  WHERE (("listings"."id" = "listing_images"."listing_id") AND ("listings"."owner_id" = "auth"."uid"())))));



CREATE POLICY "listing_images_insert_own" ON "inventory_domain"."listing_images" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "inventory_domain"."listings"
  WHERE (("listings"."id" = "listing_images"."listing_id") AND ("listings"."owner_id" = "auth"."uid"())))));



CREATE POLICY "listing_images_select_all" ON "inventory_domain"."listing_images" FOR SELECT USING (true);



CREATE POLICY "listing_images_update_own" ON "inventory_domain"."listing_images" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "inventory_domain"."listings"
  WHERE (("listings"."id" = "listing_images"."listing_id") AND ("listings"."owner_id" = "auth"."uid"())))));



ALTER TABLE "inventory_domain"."listings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "listings_delete_own" ON "inventory_domain"."listings" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "listings_insert_own" ON "inventory_domain"."listings" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "listings_select_active" ON "inventory_domain"."listings" FOR SELECT USING ((("is_active" = true) OR ("auth"."uid"() = "owner_id")));



CREATE POLICY "listings_update_own" ON "inventory_domain"."listings" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "rentals_domain"."rental_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rental_items_insert_policy" ON "rentals_domain"."rental_items" FOR INSERT WITH CHECK ("rentals_domain"."bypass_is_order_renter"("order_id", "auth"."uid"()));



CREATE POLICY "rental_items_owner_update_policy" ON "rentals_domain"."rental_items" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "rental_items_select_policy" ON "rentals_domain"."rental_items" FOR SELECT USING ((("auth"."uid"() = "owner_id") OR "rentals_domain"."bypass_is_order_renter"("order_id", "auth"."uid"())));



ALTER TABLE "rentals_domain"."rental_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rental_orders_insert_own" ON "rentals_domain"."rental_orders" FOR INSERT WITH CHECK (("auth"."uid"() = "renter_id"));



CREATE POLICY "rental_orders_owner_update_policy" ON "rentals_domain"."rental_orders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "rentals_domain"."rental_items"
  WHERE (("rental_items"."order_id" = "rental_orders"."id") AND ("rental_items"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "rentals_domain"."rental_items"
  WHERE (("rental_items"."order_id" = "rental_orders"."id") AND ("rental_items"."owner_id" = "auth"."uid"())))));



CREATE POLICY "rental_orders_select_policy" ON "rentals_domain"."rental_orders" FOR SELECT USING ((("auth"."uid"() = "renter_id") OR "rentals_domain"."bypass_is_order_owner"("id", "auth"."uid"())));



ALTER TABLE "rentals_domain"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_owner_select_policy" ON "rentals_domain"."transactions" FOR SELECT USING ("rentals_domain"."bypass_is_order_owner"("order_id", "auth"."uid"()));



CREATE POLICY "transactions_owner_update_policy" ON "rentals_domain"."transactions" FOR UPDATE USING ("rentals_domain"."bypass_is_order_owner"("order_id", "auth"."uid"())) WITH CHECK ("rentals_domain"."bypass_is_order_owner"("order_id", "auth"."uid"()));



CREATE POLICY "transactions_select_own" ON "rentals_domain"."transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "rentals_domain"."rental_orders"
  WHERE (("rental_orders"."id" = "transactions"."order_id") AND ("rental_orders"."renter_id" = "auth"."uid"())))));



CREATE POLICY "addresses_delete_own" ON "users_domain"."user_addresses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "addresses_insert_own" ON "users_domain"."user_addresses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "addresses_select_own" ON "users_domain"."user_addresses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "addresses_update_own" ON "users_domain"."user_addresses" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "users_domain"."currencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "currencies_select_all" ON "users_domain"."currencies" FOR SELECT USING (true);



ALTER TABLE "users_domain"."languages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "languages_select_all" ON "users_domain"."languages" FOR SELECT USING (true);



CREATE POLICY "payment_methods_delete_own" ON "users_domain"."user_payment_methods" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "payment_methods_insert_own" ON "users_domain"."user_payment_methods" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "payment_methods_select_own" ON "users_domain"."user_payment_methods" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "payment_methods_update_own" ON "users_domain"."user_payment_methods" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "users_domain"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_own" ON "users_domain"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_insert_own" ON "users_domain"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_all" ON "users_domain"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update_own" ON "users_domain"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "users_domain"."user_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "users_domain"."user_payment_methods" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "inventory_domain" TO "anon";
GRANT USAGE ON SCHEMA "inventory_domain" TO "authenticated";
GRANT USAGE ON SCHEMA "inventory_domain" TO "service_role";



GRANT USAGE ON SCHEMA "rentals_domain" TO "anon";
GRANT USAGE ON SCHEMA "rentals_domain" TO "authenticated";
GRANT USAGE ON SCHEMA "rentals_domain" TO "service_role";



GRANT USAGE ON SCHEMA "users_domain" TO "authenticated";
GRANT USAGE ON SCHEMA "users_domain" TO "service_role";



GRANT ALL ON FUNCTION "inventory_domain"."search_listings_nearby"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision, "category_slug" "text", "search_query" "text", "min_price" integer, "max_price" integer, "item_condition" "text", "page_limit" integer, "page_offset" integer, "exclude_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "inventory_domain"."search_listings_nearby"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision, "category_slug" "text", "search_query" "text", "min_price" integer, "max_price" integer, "item_condition" "text", "page_limit" integer, "page_offset" integer, "exclude_owner_id" "uuid") TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."categories" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."categories" TO "authenticated";
GRANT ALL ON TABLE "inventory_domain"."categories" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."category_translations" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."category_translations" TO "authenticated";
GRANT ALL ON TABLE "inventory_domain"."category_translations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."listing_availability_exceptions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."listing_availability_exceptions" TO "authenticated";
GRANT ALL ON TABLE "inventory_domain"."listing_availability_exceptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."listing_images" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."listing_images" TO "authenticated";
GRANT ALL ON TABLE "inventory_domain"."listing_images" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."listings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "inventory_domain"."listings" TO "authenticated";
GRANT ALL ON TABLE "inventory_domain"."listings" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "rentals_domain"."rental_items" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "rentals_domain"."rental_items" TO "authenticated";
GRANT ALL ON TABLE "rentals_domain"."rental_items" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "rentals_domain"."rental_orders" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "rentals_domain"."rental_orders" TO "authenticated";
GRANT ALL ON TABLE "rentals_domain"."rental_orders" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "rentals_domain"."transactions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "rentals_domain"."transactions" TO "authenticated";
GRANT ALL ON TABLE "rentals_domain"."transactions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."currencies" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."currencies" TO "authenticated";
GRANT ALL ON TABLE "users_domain"."currencies" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."languages" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."languages" TO "authenticated";
GRANT ALL ON TABLE "users_domain"."languages" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."profiles" TO "authenticated";
GRANT ALL ON TABLE "users_domain"."profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."user_addresses" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."user_addresses" TO "authenticated";
GRANT ALL ON TABLE "users_domain"."user_addresses" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."user_payment_methods" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "users_domain"."user_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "users_domain"."user_payment_methods" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "inventory_domain" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "inventory_domain" GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "inventory_domain" GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "inventory_domain" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "rentals_domain" GRANT USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "rentals_domain" GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "rentals_domain" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "rentals_domain" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "users_domain" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "users_domain" GRANT ALL ON TABLES TO "service_role";


-- auth.users lives outside the dumped schemas too; this is what wires up
-- users_domain.handle_new_user() (defined above) to actually run on signup.
CREATE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "users_domain"."handle_new_user"();

-- Reference/lookup data (currencies, languages), captured alongside the schema above since
-- `supabase db dump --schema` is schema-only. Required, not optional: profiles.preferred_currency
-- and listings.currency_code both default to 'EUR' and FK against users_domain.currencies, so
-- without this row every profile/listing insert fails - including the users_domain.handle_new_user()
-- trigger that fires on every signup.
INSERT INTO "users_domain"."currencies" ("code", "name", "symbol") VALUES
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('USD', 'US Dollar', '$')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "users_domain"."languages" ("code", "name", "native_name", "is_default") VALUES
  ('it', 'Italian', 'Italiano', true),
  ('en', 'English', 'English', false)
ON CONFLICT ("code") DO NOTHING;



