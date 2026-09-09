# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                          # dev server (Next.js + Turbopack)
pnpm build                        # production build
pnpm lint                         # next lint
pnpm test                         # vitest run (all tests, once)
pnpm test:watch                   # vitest watch mode
pnpm vitest run lib/utils.test.ts # run a single test file
```

CI (`.github/workflows/ci.yml`) runs `pnpm test` then `pnpm build` with placeholder Supabase env vars — a broken build with real env vars but working placeholders will still pass CI, so don't rely on CI alone to catch env-dependent issues.

Local dev needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` in `.env.local` (see `.env.docker` for the full list). Docker setup is in `DOCKER.md`; Android (Capacitor) build notes live in `Dockerfile.android`.

## Architecture

Next.js 16 App Router + Supabase (Postgres/PostGIS, Auth, Realtime) + Stripe Connect. Server components/route handlers talk to Postgres exclusively through PostgREST via the Supabase JS client — there is no ORM and no direct SQL from the app layer.

### Database: four domain schemas, not `public`

All tables live in dedicated schemas, always accessed via `.schema("...")` on the Supabase client:

- `users_domain` — `profiles`, addresses
- `inventory_domain` — categories, listings, images
- `rentals_domain` — `rental_orders`, `rental_items`, `transactions`
- `interactions_domain` — `conversations`, `messages`
- `notifications_domain` — `notifications`
- `reviews_domain` — `reviews`, `user_rating_summaries`

Migrations are plain numbered SQL files in `db/migrations/` (001…012), applied by hand against Supabase — there is no migration runner/CLI wired up in this repo. Shared TS types for these tables are hand-maintained in `lib/types.ts` (core rows) and `lib/types/chat.ts` (chat-specific) — keep them in sync manually when a migration changes a table shape.

### Two Supabase clients — this distinction is the source of most subtle bugs in this codebase

- **User-scoped client** (`lib/supabase/server.ts` `createClient()`, or `lib/supabase/client.ts` for the browser): reads the session cookie, RLS applies.
- **Admin client** (`lib/supabase/admin.ts` `createAdminClient()`, `server-only`): service-role key, bypasses RLS entirely.

Rule of thumb enforced across the codebase (see comments in `lib/stripe.ts` and `app/api/stripe/webhook/route.ts`): use the admin client only for writes that legitimately cross user boundaries and have no request-scoped session to authorize them with (the Stripe webhook, `upsertAuthorizedTransaction`, notification creation writing into someone else's inbox). Everything a user does to their own/their counterparty's rows through an authenticated request should go through the user-scoped client so RLS is the actual authorization mechanism — don't reach for the admin client just to make a blocked write succeed; add the missing RLS policy instead (see below).

### RLS failure mode: silent no-ops, not errors

A recurring, already-shipped-and-fixed class of bug in this repo (migrations 003, 005, 006, 007): a Postgres `UPDATE`/`INSERT` blocked by RLS (missing or wrong policy) returns success with 0 rows affected — no exception, no error field — if the caller doesn't check row count. Two defenses are already in place and must be preserved when adding new mutations against these schemas:

1. Every `.update()`/`.insert()` call in API routes chains `.select().single()` (or uses the `requireUpdate()` helper in `app/api/bookings/[id]/transition/route.ts`) so a 0-row write throws instead of silently doing nothing.
2. Custom schemas need explicit `GRANT`s for `service_role`/`anon`/`authenticated` (they are not auto-granted) *and* explicit RLS policies per command (`SELECT`/`INSERT`/`UPDATE` are independent — having one does not imply the others). When adding a table or a new write path to an existing table, check both grants and per-command policies exist, don't assume they carry over.

Adding a **brand-new schema** (not just a new table in an existing one — e.g. `reviews_domain` in migration 012) needs one more step that no SQL migration can do: Supabase only routes PostgREST requests to schemas explicitly listed as "exposed" for the Data API. Locally this is `supabase/config.toml`'s `[api].schemas` array (keep it in sync when adding a schema); on the hosted project it's a separate dashboard setting (Project Settings → API → Exposed schemas) that has to be updated by hand after running the migration, or every `.schema("new_schema_name")` call 404s with `PGRST106` and any UI reading from it just silently renders nothing rather than an error.

### Booking lifecycle (`rentals_domain.rental_orders` / `rental_items`)

Driven entirely through `POST /api/bookings/[id]/transition` (`action`: `accept | reject | cancel_request | confirm_handover | mark_returned_ok | report_damage`), which checks caller identity against `owner_id`/`renter_id` before allowing a transition. Order status flow: `pending → accepted/cancelled → paid → in_progress → completed | disputed`. Payment capture (`mark_returned_ok`) and Stripe Connect transfer happen inside this route, using the owner's user-scoped client — not the webhook — so the RLS policies on `rental_orders`/`rental_items`/`transactions` for the *owner* (not just the renter) must exist for this route to work (this is exactly what migrations 005/007 fixed after the fact).

Irreversible external side effects order relative to guarded writes: in `mark_returned_ok`, the `rental_items`/`rental_orders` updates (via `requireUpdate`) run **before** `stripe.paymentIntents.capture(...)`, not after. Those two tables are exactly the ones whose owner-side RLS policies have silently 0-rowed before (005/007) — if a write is going to be blocked, it must fail the request before the renter is charged, not after. Only the `transactions` bookkeeping update (which needs data back from the capture response) happens post-capture, and its failure is logged but doesn't block the response, since the money and the booking state have already moved by that point. Apply the same ordering when adding any new step that mixes a Stripe call with a guarded Supabase write.

### Stripe integration

- Checkout uses `capture_method: "manual"` (authorize now, capture on `mark_returned_ok`) — `session.payment_status` stays `"unpaid"` until capture, so completion is detected via `session.status === "complete"`, not `payment_status`.
- `lib/stripe.ts` `upsertAuthorizedTransaction()` is the single place that reconciles a Stripe PaymentIntent into `transactions`/`rental_orders`/`rental_items`; called from both the webhook and `/api/stripe/confirm-checkout` so the two paths can't disagree.
- Stripe Connect onboarding status (`profiles.stripe_onboarding_complete`) is kept in sync two ways: polling via `syncStripeOnboardingStatus()` (called from dashboard pages, most reliably right after the Stripe onboarding return redirect) and the `account.updated` webhook event handler (`handleAccountUpdated` in the webhook route) — both use the same `charges_enabled && payouts_enabled` predicate; keep them matching if either changes. Both paths also flip the flag with an optimistic-concurrency guard (`.eq("stripe_onboarding_complete", <value they read>)` on the update, checked via `.select().maybeSingle()`) and only send the `stripe_onboarding_complete` notification when their own write actually affected a row. Without that guard the page-load poll (which runs first, since it's on the Stripe return URL) and the webhook (which arrives later) race to flip the same false→true transition, and whichever loses silently produces no notification at all rather than a duplicate — don't remove the guard when touching this code.
- Platform fee is a flat `PLATFORM_FEE_PERCENT` (10%) in `lib/stripe.ts`.

### Chat (`interactions_domain`)

One conversation per `rental_order_id` (unique constraint), between the two `rental_items` counterparties. Deleting a profile does **not** cascade-delete conversations/messages (migration 004 changed this deliberately) — `participant_one`/`participant_two`/`sender_id` go `NULL` instead, and the UI (`components/chat/message-list.tsx`, the conversations route) renders a null sender/participant as "utente eliminato" rather than erroring. Realtime updates go through `lib/chat/realtime.ts` (Supabase Realtime subscriptions), not polling.

### Notifications (`notifications_domain`)

Always written by trusted server code via the admin client (`lib/notifications/create.ts`) — there is deliberately no `authenticated`-role INSERT policy, since a user's own session has no legitimate reason to write into someone else's inbox. Copy/i18n for notification types lives in `lib/notifications/copy.ts`; email sending in `lib/notifications/email.ts` (Resend); push sending in `lib/notifications/push.ts` (Firebase Cloud Messaging, `FIREBASE_SERVICE_ACCOUNT_JSON`, Android-only client so far — see the Flutter app's `PushNotificationsService`). Push currently mirrors the `inApp` preference (no separate push toggle/column yet — `device_tokens` has no per-alert-type granularity). Device tokens (`notifications_domain.device_tokens`, migration 014) are the one exception to "notifications writes go through the admin client": registering/unregistering *your own* token (`app/api/notifications/device-tokens/route.ts`) is a same-session write, so it uses the user-scoped client like any other user-owned row — only *reading another user's* tokens to fan out a push is a cross-user operation and goes through the admin client.

Realtime `postgres_changes` events are **not** actually scoped by RLS on the wire in this project (confirmed the hard way in `lib/chat/realtime.ts`'s `useRealtimeConversations`, which has to guard client-side because `messages` has no column to filter on) — do not assume a bare `recipient_id = auth.uid()` SELECT policy is enough to keep a channel private. Because `notifications` *does* have a `recipient_id` column, `lib/notifications/use-unread-count.tsx` subscribes with an explicit `filter: recipient_id=eq.<userId>` rather than relying on RLS; keep using a server-side filter (same pattern as `useRealtimeMessages`'s `conversation_id` filter) for any new subscription on this table, and fall back to the client-side-guard pattern only for tables that genuinely have no column to filter on.

### Reviews (`reviews_domain`)

Bidirectional and role-aware, not a single "user rating": a review has a `target_role` (`lender` = chi presta, `renter` = chi noleggia) and a `context` (`ferramenta` = business-account lender, one-way publish; `p2p` = two private users, double-blind publish), derived server-side from the booking — never trusted from the request body (`app/api/bookings/[id]/reviews/route.ts`, and re-enforced at the DB level by `reviews_domain.can_submit_review`, the *actual* RLS authorization boundary for `INSERT` since PostgREST is reachable directly with the caller's own session). `context` is derived from whether the booking's lender is a `business` account (`profiles.account_type`, added in migration 012) — a "ferramenta" account by convention. A completed booking can carry up to two independent review rows (one per direction); they never block on each other to be *written*, only to become *visible*.

Only `rentals_domain.rental_orders.status = 'completed'` bookings are reviewable, within a 14-day window from `updated_at` (the order's completion timestamp, since nothing updates a completed order afterwards) — see `REVIEW_WINDOW_DAYS` in `lib/reviews/rules.ts`, mirrored in the DB function.

Visibility (`reviews_domain.apply_visibility_rules`, a `BEFORE INSERT` trigger): `ferramenta`+`lender` reviews publish immediately (no retaliation risk, one-way channel). `p2p` reviews start hidden and flip to visible — both sides at once — the instant a matching counterpart review exists for the same booking; a lone `p2p` review that's still hidden 14 days after booking closure is force-revealed by the `app/api/cron/reveal-expired-reviews` route (Vercel Cron, see `vercel.json`, guarded by `CRON_SECRET`), which — like notification creation — has no request-scoped session and legitimately uses the admin client for that cross-user write. `ferramenta`+`renter` reviews (an owner's internal note on a customer, spec'd as phase-1-optional "controllo qualità clienti") never go visible at all in this iteration — there is no staff UI reading them yet.

`reviews_domain.user_rating_summaries` (one row per `user_id`/`role`/`context`) is kept fresh by an `AFTER INSERT OR UPDATE` trigger rather than a materialized view, to avoid refresh-lag on top of the cron job already needed for visibility. The same trigger also updates the pre-existing `profiles.average_rating_as_owner`/`average_rating_as_renter`/`total_reviews_as_owner`/`total_reviews_as_renter` columns (aggregated across context) so `app/users/[id]/page.tsx` and `search_listings_nearby` keep working unchanged. Phase 1 UI only surfaces the `lender`/`ferramenta` combination publicly (`components/reviews/reviews-section.tsx`); the full `p2p` schema exists already so enabling it later is a UI/flag flip, not a migration.

### Auth

`requireApiUser()` (`lib/auth/api.ts`) is the standard guard for API routes: returns the user-scoped client + user, or a 401 `NextResponse` to return early. Route protection for pages (not API routes) happens in `middleware.ts`, which redirects unauthenticated users away from a hardcoded list of protected path prefixes and authenticated users away from `/auth/login`/`/auth/sign-up`.

### i18n

`lib/i18n/` provides a language context (client) and `getServerLanguage()` (server, cookie-based) — user-facing strings (including notification copy and API error messages) are Italian-first; check `lib/i18n/` before assuming a hardcoded string should be translated inline vs. sourced from the language layer.
