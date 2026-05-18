# ToolShare

A peer-to-peer tool rental platform. A Vinted-style marketplace where individuals can rent out their tools to others.

## Features

- **Authentication** - Sign up and login with Supabase Auth
- **Listings** - Create, edit, and search tools for rent
- **Geographic Search** - Find tools near you with PostGIS
- **Bookings** - Booking system with calendar and anti-double-booking
- **Payments** - Stripe Connect for secure P2P payments
- **Dashboard** - Manage your listings and bookings

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Auth**: Supabase Auth
- **Payments**: Stripe Connect
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Database Structure

The database is organized into 4 domains:

- `users_domain` - User profiles, addresses, payment methods
- `inventory_domain` - Categories, listings, images, availability
- `rentals_domain` - Orders, rental items, transactions
- `interactions_domain` - Reviews, conversations, messages

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

## Local Development

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

## Project Structure

```
app/
  auth/           # Login, registration, callback
  bookings/       # Bookings (list, detail, new)
  dashboard/      # User dashboard
  listings/       # Listings (browse, detail, new)
components/
  bookings/       # Booking components
  dashboard/      # Dashboard components
  home/           # Homepage (hero, categories)
  layout/         # Header, footer, menu
  listings/       # Listing components
lib/
  supabase/       # Supabase client (browser/server)
  stripe.ts       # Stripe client
  types.ts        # TypeScript types
  utils.ts        # Utility functions
```

## Available Categories

- Power Tools
- Garden Equipment
- Construction
- Cleaning
- Automotive
- Woodworking
- Plumbing
- Electrical
- Painting
- Landscaping

## License

MIT
