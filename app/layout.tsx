import type { Metadata, Viewport } from "next"
import { Inter, Sora } from "next/font/google"
import Script from "next/script"
import { Suspense } from "react"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { AuthProvider } from "@/lib/auth/context"
import { ThemeProvider } from "@/lib/theme/theme-context"
import { ToastProvider } from "@/components/ui/toast-provider"
import { QueryErrorToast } from "@/components/ui/query-error-toast"
import { getSiteUrl, SITE_NAME, DEFAULT_DESCRIPTION } from "@/lib/seo"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const sora = Sora({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-sora" })

const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('pietro_theme');
    var isDark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`

const DEFAULT_TITLE = `${SITE_NAME} - Noleggio Attrezzi tra Privati`

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "noleggio attrezzi",
    "sharing economy",
    "noleggio tra privati",
    "attrezzi da lavoro",
    "tool rental",
  ],
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3b82f6",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" className="bg-background" suppressHydrationWarning>
      <head>
        <Script id="no-flash-theme" strategy="beforeInteractive">
          {NO_FLASH_THEME_SCRIPT}
        </Script>
      </head>
      <body className={`${inter.variable} ${sora.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <Suspense fallback={null}>
                <QueryErrorToast />
              </Suspense>
              <AuthProvider>
                <div className="flex min-h-screen flex-col">
                  <Header />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
              </AuthProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

