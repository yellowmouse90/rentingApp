// Database types for ToolShare
export interface Profile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  phone: string | null
  is_verified: boolean
  preferred_currency: string
  stripe_customer_id: string | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  average_rating_as_owner: number
  average_rating_as_renter: number
  total_reviews_as_owner: number
  total_reviews_as_renter: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon_name: string | null
  parent_id: string | null
}

export interface Listing {
  id: string
  owner_id: string
  category_id: string | null
  title: string
  description: string | null
  condition: "new" | "like_new" | "good" | "fair"
  price_per_day_cents: number
  price_per_week_cents: number | null
  currency_code: string
  deposit_cents: number
  location_address_id: string | null
  latitude: number | null
  longitude: number | null
  is_available: boolean
  is_active: boolean
  views_count: number
  created_at: string
  updated_at: string
  // Joined fields
  owner?: Profile
  category?: Category
  images?: ListingImage[]
}

export interface ListingImage {
  id: string
  listing_id: string
  image_url: string
  display_order: number
  created_at: string
}

export interface UserAddress {
  id: string
  user_id: string
  label: string | null
  street_address: string
  city: string
  postal_code: string | null
  region: string | null
  country_code: string
  latitude: number | null
  longitude: number | null
  is_default: boolean
  created_at: string
}

export interface RentalOrder {
  id: string
  renter_id: string
  status:
    | "pending"
    | "approved"
    | "ongoing"
    | "completed"
    | "cancelled"
    | "disputed"
    | "accepted"
    | "paid"
    | "in_progress"
  subtotal_cents: number
  service_fee_cents: number
  total_deposit_cents: number
  grand_total_cents: number
  currency_code: string
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  renter?: Profile
  items?: RentalItem[]
}

export interface RentalItem {
  id: string
  order_id: string
  listing_id: string
  owner_id: string
  start_date: string
  end_date: string
  daily_rate_cents: number
  total_days: number
  item_subtotal_cents: number
  deposit_cents: number
  status:
    | "requested"
    | "approved"
    | "ongoing"
    | "completed"
    | "cancelled"
    | "disputed"
    | "unavailable"
    | "accepted"
    | "paid"
    | "collected"
    | "returned_ok"
    | "damaged"
  created_at: string
  updated_at: string
  // Joined fields
  listing?: Listing
  owner?: Profile
}

export interface Review {
  id: string
  rental_item_id: string
  reviewer_id: string
  reviewee_id: string
  review_type: "owner" | "renter"
  rating: number
  comment: string | null
  created_at: string
  // Joined fields
  reviewer?: Profile
}

export interface Conversation {
  id: string
  listing_id: string | null
  participant_one: string
  participant_two: string
  last_message_at: string | null
  created_at: string
  // Joined fields
  listing?: Listing
  other_participant?: Profile
  last_message?: Message
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  // Joined fields
  sender?: Profile
}

// Utility type for currency formatting
export interface Currency {
  code: string
  name: string
  symbol: string
}
