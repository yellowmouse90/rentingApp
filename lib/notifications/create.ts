import "server-only"

import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getEffectivePreference } from "./preferences"
import { sendNotificationEmail } from "./email"
import { sendPushNotification } from "./push"
import { getNotificationCopy, getNotificationLinkUrl, getNotificationCtaLabel, type CopyParams } from "./copy"
import { renderNotificationEmail } from "./email-template"
import { SITE_NAME } from "@/lib/seo"
import type { AlertType } from "./types"

interface CreateNotificationParams {
  recipientId: string
  actorId: string | null
  type: AlertType
  copyParams?: CopyParams
  orderId?: string
  conversationId?: string
  // When false, this only pushes (and emails, if that preference is on) - it never writes a row
  // to notifications_domain.notifications, so it never shows up in the in-app bell list. For
  // alert types that already have their own dedicated surface (new_message: the chat screen
  // itself), the bell list would just be a duplicate the recipient can't act on from there.
  // Defaults to true for every existing call site.
  persist?: boolean
}

// Never lets a notification failure fail the caller's own action (a booking
// transition, a webhook) - notifications are always best-effort, so every
// failure path here is caught and logged, never re-thrown.
//
// Resolves the recipient's email and language itself (via the admin client)
// rather than requiring every call site to fetch them up front - callers only
// ever need to know the recipient's id. Language in particular must be looked
// up here rather than passed in: the caller is usually acting on behalf of
// the *other* party to the notification (e.g. the owner accepting a booking
// notifies the renter), so the caller's own request-scoped language (their
// cookie, via getServerLanguage()) is never the right language for this
// message - only the recipient's own persisted preference is.
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const supabase = createAdminClient()
    const preference = await getEffectivePreference(supabase, params.recipientId, params.type)

    if (!preference.inApp && !preference.email) return

    const { data: recipientProfile } = await supabase
      .schema("users_domain")
      .from("profiles")
      .select("email, preferred_language")
      .eq("id", params.recipientId)
      .maybeSingle()

    const language = recipientProfile?.preferred_language ?? "it"

    const { title, body } = getNotificationCopy(params.type, language, {
      ...params.copyParams,
      orderId: params.orderId,
      conversationId: params.conversationId,
    })
    const linkUrl = getNotificationLinkUrl(params.type, params.orderId, params.conversationId)

    if (preference.inApp && params.persist === false) {
      // Push mirrors the in-app toggle for now (no separate preference row/column yet) - after()
      // for the same reason as the email send below: never hold up the caller's response on it.
      after(() => sendPushNotification({ recipientId: params.recipientId, title, body, linkUrl }))
    } else if (preference.inApp) {
      const { error } = await supabase.schema("notifications_domain").from("notifications").insert({
        recipient_id: params.recipientId,
        actor_id: params.actorId,
        type: params.type,
        title,
        body,
        link_url: linkUrl,
        related_order_id: params.orderId ?? null,
      })
      if (error) {
        console.error("Notifiche: inserimento riga fallito", params.type, error)
      } else {
        after(() => sendPushNotification({ recipientId: params.recipientId, title, body, linkUrl }))
      }
    }

    if (preference.email) {
      if (recipientProfile?.email) {
        const html = renderNotificationEmail({
          title,
          body,
          language,
          linkUrl,
          ctaLabel: linkUrl ? getNotificationCtaLabel(params.type, language, params.orderId) : undefined,
        })
        // Non-blocking: schedule the outbound email after the response is
        // sent instead of holding up the caller's API response on it (first
        // use of next/server's after() in this codebase).
        after(() => sendNotificationEmail(recipientProfile.email, `${SITE_NAME} · ${title}`, html))
      } else {
        console.warn("Notifiche: email destinatario non trovata, invio saltato", params.recipientId)
      }
    }
  } catch (error) {
    console.error("Notifiche: creazione notifica fallita", params.type, error)
  }
}
