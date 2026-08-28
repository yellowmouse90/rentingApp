import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Come funziona",
  description:
    "Scopri come noleggiare o mettere a reddito i tuoi attrezzi da lavoro: cerca, prenota e noleggia in sicurezza tra privati.",
}

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children
}
