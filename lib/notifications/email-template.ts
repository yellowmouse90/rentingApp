import "server-only"

import { getSiteUrl, SITE_NAME } from "@/lib/seo"

type Language = "it" | "en"

interface RenderNotificationEmailParams {
  title: string
  body: string
  language: Language
  ctaLabel?: string
  linkUrl?: string | null
}

const FOOTER_COPY: Record<Language, { preferences: string; automated: string; signature: string }> = {
  it: {
    preferences: "Gestisci le tue preferenze di notifica",
    automated: "Questa è un'email automatica: non rispondere direttamente a questo messaggio.",
    signature: `Il team di ${SITE_NAME}`,
  },
  en: {
    preferences: "Manage your notification preferences",
    automated: "This is an automated email: please don't reply directly to this message.",
    signature: `The ${SITE_NAME} team`,
  },
}

// Inline styles + table-free but simple block layout: kept deliberately basic
// (no external stylesheet, no web fonts) since notification emails are sent
// through Resend and rendered by arbitrary mail clients, several of which
// strip <style> blocks or ignore external CSS entirely.
export function renderNotificationEmail(params: RenderNotificationEmailParams): string {
  const { title, body, language, ctaLabel, linkUrl } = params
  const siteUrl = getSiteUrl()
  const footer = FOOTER_COPY[language]
  const preferencesUrl = `${siteUrl}/profile/edit`
  const absoluteLinkUrl = linkUrl ? `${siteUrl}${linkUrl}` : null

  const ctaHtml = absoluteLinkUrl
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 0;">
        <tr>
          <td style="border-radius: 6px; background-color: #16a34a;">
            <a href="${absoluteLinkUrl}" target="_blank" rel="noopener noreferrer"
               style="display: inline-block; padding: 12px 24px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
              ${ctaLabel ?? title}
            </a>
          </td>
        </tr>
      </table>`
    : ""

  return `
<div style="background-color: #f4f4f5; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e4e4e7;">
    <div style="background-color: #111827; padding: 20px 24px;">
      <a href="${siteUrl}" target="_blank" rel="noopener noreferrer"
         style="font-size: 20px; font-weight: 700; color: #ffffff; text-decoration: none;">${SITE_NAME}</a>
    </div>
    <div style="padding: 24px;">
      <h1 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #111827;">${title}</h1>
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3f3f46;">${body}</p>
      ${ctaHtml}
    </div>
    <div style="padding: 20px 24px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #71717a;">${footer.signature}</p>
      <p style="margin: 0 0 4px; font-size: 12px; color: #a1a1aa;">${footer.automated}</p>
      <p style="margin: 0; font-size: 12px;">
        <a href="${preferencesUrl}" target="_blank" rel="noopener noreferrer" style="color: #71717a;">${footer.preferences}</a>
      </p>
    </div>
  </div>
</div>`
}
