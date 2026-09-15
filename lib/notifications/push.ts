import "server-only"

import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getMessaging } from "firebase-admin/messaging"
import { createAdminClient } from "@/lib/supabase/admin"

let firebaseApp: App | null | undefined

// Lazily initialized (not at module load) so a missing/invalid credential only breaks push
// sending, never the rest of the module graph - mirrors getResend() in lib/notifications/email.ts.
function getFirebaseApp(): App | null {
  if (firebaseApp !== undefined) return firebaseApp

  const existing = getApps()
  if (existing.length > 0) {
    firebaseApp = existing[0]!
    return firebaseApp
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!json) {
    firebaseApp = null
    return firebaseApp
  }

  try {
    const serviceAccount = JSON.parse(json)
    firebaseApp = initializeApp({ credential: cert(serviceAccount) })
  } catch (error) {
    console.error("Push: FIREBASE_SERVICE_ACCOUNT_JSON non valido", error)
    firebaseApp = null
  }
  return firebaseApp
}

interface SendPushParams {
  recipientId: string
  title: string
  body: string
  linkUrl: string | null
}

// Fail-soft by design, same posture as sendNotificationEmail: the in-app notification row is
// already committed before this is ever called (see create.ts), so a missing credential or a
// failed FCM call never loses the notification itself, only the push channel.
export async function sendPushNotification(params: SendPushParams): Promise<void> {
  const app = getFirebaseApp()
  if (!app) {
    console.warn("Push: FIREBASE_SERVICE_ACCOUNT_JSON non configurata, invio push saltato")
    return
  }

  const supabase = createAdminClient()
  const { data: tokens, error } = await supabase
    .schema("notifications_domain")
    .from("device_tokens")
    .select("token")
    .eq("user_id", params.recipientId)

  if (error) {
    console.error("Push: lettura device token fallita", error)
    return
  }
  if (!tokens || tokens.length === 0) return

  // Chat messages get a deterministic Android tag derived from the conversation id, so a later
  // message in the same conversation replaces the tray entry instead of stacking, and the app can
  // cancel it (see PushNotificationsService.cancelForConversation) once the user opens that chat -
  // both the background/terminated auto-display path and the foreground local-notification path
  // (which mirrors this same tag) rely on it. Same check also picks the small icon: a chat bubble
  // for messages vs. the manifest's default app-mark icon (AndroidManifest.xml's
  // default_notification_icon) for everything else - mirrors PushNotificationsService's own
  // foreground icon choice, which uses this identical linkUrl pattern.
  const conversationMatch = params.linkUrl?.match(/^\/messages\?conversation=([^&]+)/)

  try {
    const response = await getMessaging(app).sendEachForMulticast({
      tokens: tokens.map((t) => t.token as string),
      notification: { title: params.title, body: params.body },
      android: {
        notification: {
          tag: conversationMatch ? `chat_${conversationMatch[1]}` : undefined,
          icon: conversationMatch ? "ic_notification_chat" : undefined,
          // App brand blue (lib/core/theme/app_theme.dart's `_primaryLight` on the Flutter side) -
          // explicit here rather than relying solely on AndroidManifest.xml's
          // default_notification_color, which some OEM skins ignore for auto-displayed pushes.
          color: "#2451D9",
        },
      },
      data: { linkUrl: params.linkUrl ?? "" },
    })

    const staleTokens = response.responses
      .map((r, i) => (!r.success && r.error?.code === "messaging/registration-token-not-registered" ? tokens[i]!.token : null))
      .filter((t): t is string => t !== null)

    if (staleTokens.length > 0) {
      await supabase.schema("notifications_domain").from("device_tokens").delete().in("token", staleTokens)
    }
  } catch (error) {
    console.error("Push: invio fallito", error)
  }
}
