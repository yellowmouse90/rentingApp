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

  try {
    const response = await getMessaging(app).sendEachForMulticast({
      tokens: tokens.map((t) => t.token as string),
      notification: { title: params.title, body: params.body },
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
