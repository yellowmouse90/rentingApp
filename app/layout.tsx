import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "ToolShare - Noleggio Attrezzi tra Privati",
  description:
    "La piattaforma di sharing economy per noleggiare attrezzi da lavoro tra privati. Trova l'attrezzo che ti serve o metti a reddito i tuoi.",
  keywords: [
    "noleggio attrezzi",
    "sharing economy",
    "noleggio tra privati",
    "attrezzi da lavoro",
    "tool rental",
  ],
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
    <html lang="it" className="bg-background">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
