import type { APIRequestContext } from "@playwright/test"
import { getTestStripe } from "./stripe"

// lib/stripe.ts imports "server-only", which throws unconditionally unless resolved through
// Next's own bundler (it only no-ops under the "react-server" module condition Next sets) - so
// upsertAuthorizedTransaction()/voidAuthorizationForCancelledOrder() can't be imported and called
// directly from a plain Playwright test process. Driving them through a real signed webhook
// call (the same as Stripe itself would) exercises the exact same code, through its real entry
// point, without needing that condition.
export function signWebhookPayload(payload: object) {
  const stripe = getTestStripe()
  const body = JSON.stringify(payload)
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  })
  return { body, signature }
}

export async function postSignedWebhook(request: APIRequestContext, payload: object) {
  const { body, signature } = signWebhookPayload(payload)
  return request.post("/api/stripe/webhook", {
    data: body,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  })
}
