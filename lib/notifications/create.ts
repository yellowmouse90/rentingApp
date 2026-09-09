import "server-only"

import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getEffectivePreference } from "./preferences"
import { sendNotificationEmail } from "./email"
import { sendPushNotification } from "./push"
import { getNotificationCopy, getNotificationLinkUrl, type CopyParams } from "./copy"
import type { AlertType } from "./types"

interface CreateNotificationParams {
  recipientId: string
  actorId: string | null
  type: AlertType
  language: "it" | "en"
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
// Resolves the recipient's email itself (via the admin client, only when the
// email preference is actually on) rather than requiring every call site to
// fetch it up front - callers only ever need to know the recipient's id.
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const supabase = createAdminClient()
    const preference = await getEffectivePreference(supabase, params.recipientId, params.type)

    if (!preference.inApp && !preference.email) return

    const { title, body } = getNotificationCopy(params.type, params.language, {
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
      const { data: recipientProfile } = await supabase
        .schema("users_domain")
        .from("profiles")
        .select("email")
        .eq("id", params.recipientId)
        .maybeSingle()

      if (recipientProfile?.email) {
        // Non-blocking: schedule the outbound email after the response is
        // sent instead of holding up the caller's API response on it (first
        // use of next/server's after() in this codebase).
        after(() => sendNotificationEmail(recipientProfile.email, title, `<p>${body}</p>`))
      } else {
        console.warn("Notifiche: email destinatario non trovata, invio saltato", params.recipientId)
      }
    }
  } catch (error) {
    console.error("Notifiche: creazione notifica fallita", params.type, error)
  }
}
