"use client"

import { useLanguage } from "@/lib/i18n/language-context"
import { Globe } from "lucide-react"

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <button
      onClick={() => setLanguage(language === "it" ? "en" : "it")}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={language === "it" ? "Switch to English" : "Passa all'italiano"}
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{language}</span>
    </button>
  )
}

