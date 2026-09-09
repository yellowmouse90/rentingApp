import { createSwaggerSpec } from "next-swagger-doc"

// Scans app/api/**/*.ts for `@swagger` JSDoc blocks on every request and rebuilds
// the spec from source - no separate file to keep in sync by hand. See app/api/docs/route.ts
// (serves this JSON) and app/docs/page.tsx (renders it with Swagger UI).
export function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: "app/api",
    definition: {
      openapi: "3.0.3",
      info: {
        title: "rentingApp API",
        version: "1.0.0",
        description:
          "API interne di rentingApp (Next.js App Router). Tutte le route parlano con Postgres esclusivamente via PostgREST (Supabase JS client), su 6 schemi dedicati - non c'è un ORM. La maggior parte delle route richiede il cookie di sessione Supabase (`requireApiUser()`); il webhook Stripe verifica `stripe-signature`, la route cron richiede `Authorization: Bearer CRON_SECRET`.",
      },
      servers: [{ url: "/api", description: "Stesso host dell'app Next.js" }],
      tags: [
        { name: "Bookings", description: "Ciclo di vita delle prenotazioni (rentals_domain)" },
        { name: "Reviews", description: "Recensioni bidirezionali (reviews_domain)" },
        { name: "Chat", description: "Conversazioni e messaggi (interactions_domain)" },
        { name: "Notifications", description: "Notifiche in-app (notifications_domain)" },
        { name: "Listings", description: "Annunci (inventory_domain)" },
        { name: "Stripe", description: "Pagamenti e Stripe Connect" },
        { name: "Users", description: "Profili pubblici e valutazioni" },
        { name: "Cron", description: "Job schedulati (Vercel Cron)" },
        { name: "Debug", description: "Endpoint diagnostici, non destinati alla produzione" },
      ],
      components: {
        securitySchemes: {
          supabaseSessionCookie: {
            type: "apiKey",
            in: "cookie",
            name: "sb-access-token",
            description: "Sessione Supabase Auth impostata dal browser dopo il login (requireApiUser()).",
          },
          cronSecret: {
            type: "http",
            scheme: "bearer",
            description: "Confrontato con la variabile d'ambiente CRON_SECRET.",
          },
          stripeSignature: {
            type: "apiKey",
            in: "header",
            name: "stripe-signature",
            description: "Firma HMAC generata da Stripe, verificata con STRIPE_WEBHOOK_SECRET.",
          },
        },
        schemas: {
          Error: {
            type: "object",
            required: ["error"],
            properties: { error: { type: "string" } },
          },
          Ok: {
            type: "object",
            properties: { ok: { type: "boolean", enum: [true] } },
          },
          TransitionAction: {
            type: "string",
            enum: ["accept", "reject", "cancel_request", "confirm_handover", "mark_returned_ok", "report_damage"],
          },
          ReviewTargetRole: { type: "string", enum: ["lender", "renter"] },
          ReviewContext: { type: "string", enum: ["ferramenta", "p2p"] },
          ReviewInput: {
            type: "object",
            required: ["target_role", "overall_rating"],
            properties: {
              target_role: { $ref: "#/components/schemas/ReviewTargetRole" },
              overall_rating: { type: "integer", minimum: 1, maximum: 5 },
              sub_ratings: {
                type: "object",
                additionalProperties: { type: "integer", minimum: 1, maximum: 5 },
              },
              comment: { type: "string", maxLength: 2000, nullable: true },
              tags: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 6 },
            },
          },
          AlertType: {
            type: "string",
            enum: [
              "booking_requested",
              "booking_accepted",
              "booking_rejected",
              "booking_cancelled_by_renter",
              "booking_paid",
              "booking_handover_confirmed",
              "booking_returned_ok",
              "booking_damage_reported",
              "payment_succeeded",
              "payment_failed",
              "stripe_onboarding_complete",
              "review_received",
              "new_message",
            ],
          },
          Notification: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              actor_id: { type: "string", format: "uuid", nullable: true },
              type: { $ref: "#/components/schemas/AlertType" },
              title: { type: "string" },
              body: { type: "string" },
              link_url: { type: "string", nullable: true },
              is_read: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          Message: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              conversation_id: { type: "string", format: "uuid" },
              sender_id: { type: "string", format: "uuid", nullable: true, description: "NULL se il mittente ha eliminato il profilo." },
              content: { type: "string" },
              is_read: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          Conversation: {
            type: "object",
            description: "Riga arricchita di interactions_domain.conversations: una per rental_order_id.",
            properties: {
              id: { type: "string", format: "uuid" },
              rental_order_id: { type: "string", format: "uuid" },
              participant_one: { type: "string", format: "uuid", nullable: true },
              participant_two: { type: "string", format: "uuid", nullable: true },
              last_message_at: { type: "string", format: "date-time", nullable: true },
              other_participant_details: { type: "object", nullable: true },
              rental_order: { type: "object", nullable: true },
              unread_count: { type: "integer" },
            },
          },
        },
      },
      security: [],
    },
  })
}
