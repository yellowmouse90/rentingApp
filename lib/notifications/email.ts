import "server-only"

import { Resend } from "resend"

let resendInstance: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendInstance) resendInstance = new Resend(process.env.RESEND_API_KEY)
  return resendInstance
}

// Fail-soft by design, in dev and in prod: the in-app notification row is
// already committed before this is ever called (see create.ts), so a missing
// key or a failed send never loses the notification itself, only the email
// channel. This is called from `after()` - after the HTTP response has
// already been sent - so throwing here could never reach the caller anyway;
// it would only turn into a noisier unhandled-rejection log. Same
// best-effort posture as syncStripeOnboardingStatus in lib/stripe.ts.
export async function sendNotificationEmail(to: string, subject: string, html: string) {
  const resend = getResend()
  if (!resend) {
    console.warn("Notifiche: RESEND_API_KEY non configurata, invio email saltato", { to, subject })
    return { sent: false as const, reason: "no_api_key" as const }
  }

  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    console.warn("Notifiche: RESEND_FROM_EMAIL non configurata, invio email saltato", { to, subject })
    return { sent: false as const, reason: "no_from_address" as const }
  }

  try {
    await resend.emails.send({ from, to, subject, html })
    return { sent: true as const }
  } catch (error) {
    console.error("Notifiche: invio email fallito", { to, subject, error })
    return { sent: false as const, reason: "send_error" as const }
  }
}
