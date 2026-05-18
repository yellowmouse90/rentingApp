"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

type Language = "it" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  tCategory: (categoryId: string, fallback: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  it: {
    // Header
    "nav.home": "Home",
    "nav.listings": "Annunci",
    "nav.how_it_works": "Come Funziona",
    "nav.login": "Accedi",
    "nav.signup": "Registrati",
    "nav.dashboard": "Dashboard",
    "nav.my_listings": "I Miei Annunci",
    "nav.my_bookings": "Le Mie Prenotazioni",
    "nav.messages": "Messaggi",
    "nav.profile": "Profilo",
    "nav.logout": "Esci",
    
    // Homepage
    "home.hero.title": "Noleggia attrezzi dai tuoi vicini",
    "home.hero.subtitle": "Risparmia denaro e spazio noleggiando gli attrezzi di cui hai bisogno, quando ne hai bisogno.",
    "home.hero.search_placeholder": "Cosa stai cercando?",
    "home.hero.search_button": "Cerca",
    "home.categories.title": "Sfoglia per Categoria",
    "home.featured.title": "Annunci in Evidenza",
    "home.how.title": "Come Funziona",
    "home.how.step1.title": "Cerca",
    "home.how.step1.desc": "Trova l'attrezzo di cui hai bisogno tra migliaia di annunci vicino a te.",
    "home.how.step2.title": "Prenota",
    "home.how.step2.desc": "Scegli le date e invia una richiesta di noleggio al proprietario.",
    "home.how.step3.title": "Noleggia",
    "home.how.step3.desc": "Ritira l'attrezzo, usalo e restituiscilo alla fine del periodo.",
    "home.cta.title": "Hai attrezzi inutilizzati?",
    "home.cta.subtitle": "Guadagna condividendoli con la tua community.",
    "home.cta.button": "Inizia a Noleggiare",
    
    // Listings
    "listings.title": "Annunci",
    "listings.filters.category": "Categoria",
    "listings.filters.all_categories": "Tutte le categorie",
    "listings.filters.condition": "Condizione",
    "listings.filters.all_conditions": "Tutte le condizioni",
    "listings.filters.price_range": "Fascia di Prezzo",
    "listings.filters.min_price": "Min",
    "listings.filters.max_price": "Max",
    "listings.filters.apply": "Applica Filtri",
    "listings.filters.reset": "Reset",
    "listings.no_results": "Nessun annuncio trovato",
    "listings.per_day": "/giorno",
    "listings.distance": "km di distanza",
    
    // Listing Detail
    "listing.contact_owner": "Contatta il Proprietario",
    "listing.book_now": "Prenota Ora",
    "listing.description": "Descrizione",
    "listing.condition": "Condizione",
    "listing.deposit": "Deposito",
    "listing.owner": "Proprietario",
    "listing.member_since": "Membro da",
    "listing.reviews": "recensioni",
    
    // Conditions
    "condition.new": "Nuovo",
    "condition.like_new": "Come Nuovo",
    "condition.good": "Buono",
    "condition.fair": "Discreto",
    
    // Booking
    "booking.select_dates": "Seleziona Date",
    "booking.start_date": "Data Inizio",
    "booking.end_date": "Data Fine",
    "booking.summary": "Riepilogo",
    "booking.days": "giorni",
    "booking.subtotal": "Subtotale",
    "booking.service_fee": "Commissione Servizio",
    "booking.deposit": "Deposito Cauzionale",
    "booking.total": "Totale",
    "booking.confirm": "Conferma Prenotazione",
    "booking.request_sent": "Richiesta Inviata",
    
    // Auth
    "auth.login": "Accedi",
    "auth.signup": "Registrati",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.confirm_password": "Conferma Password",
    "auth.display_name": "Nome Visualizzato",
    "auth.forgot_password": "Password dimenticata?",
    "auth.no_account": "Non hai un account?",
    "auth.have_account": "Hai gia un account?",
    "auth.or": "oppure",
    "auth.continue_google": "Continua con Google",
    
    // Footer
    "footer.about": "Chi Siamo",
    "footer.help": "Centro Assistenza",
    "footer.terms": "Termini di Servizio",
    "footer.privacy": "Privacy",
    "footer.rights": "Tutti i diritti riservati.",
    
    // Common
    "common.loading": "Caricamento...",
    "common.error": "Si e verificato un errore",
    "common.save": "Salva",
    "common.cancel": "Annulla",
    "common.delete": "Elimina",
    "common.edit": "Modifica",
    "common.view": "Visualizza",
    "common.search": "Cerca",
    "common.close": "Chiudi",
  },
  en: {
    // Header
    "nav.home": "Home",
    "nav.listings": "Listings",
    "nav.how_it_works": "How It Works",
    "nav.login": "Login",
    "nav.signup": "Sign Up",
    "nav.dashboard": "Dashboard",
    "nav.my_listings": "My Listings",
    "nav.my_bookings": "My Bookings",
    "nav.messages": "Messages",
    "nav.profile": "Profile",
    "nav.logout": "Logout",
    
    // Homepage
    "home.hero.title": "Rent tools from your neighbors",
    "home.hero.subtitle": "Save money and space by renting the tools you need, when you need them.",
    "home.hero.search_placeholder": "What are you looking for?",
    "home.hero.search_button": "Search",
    "home.categories.title": "Browse by Category",
    "home.featured.title": "Featured Listings",
    "home.how.title": "How It Works",
    "home.how.step1.title": "Search",
    "home.how.step1.desc": "Find the tool you need among thousands of listings near you.",
    "home.how.step2.title": "Book",
    "home.how.step2.desc": "Choose the dates and send a rental request to the owner.",
    "home.how.step3.title": "Rent",
    "home.how.step3.desc": "Pick up the tool, use it, and return it at the end of the period.",
    "home.cta.title": "Have unused tools?",
    "home.cta.subtitle": "Earn money by sharing them with your community.",
    "home.cta.button": "Start Renting Out",
    
    // Listings
    "listings.title": "Listings",
    "listings.filters.category": "Category",
    "listings.filters.all_categories": "All categories",
    "listings.filters.condition": "Condition",
    "listings.filters.all_conditions": "All conditions",
    "listings.filters.price_range": "Price Range",
    "listings.filters.min_price": "Min",
    "listings.filters.max_price": "Max",
    "listings.filters.apply": "Apply Filters",
    "listings.filters.reset": "Reset",
    "listings.no_results": "No listings found",
    "listings.per_day": "/day",
    "listings.distance": "km away",
    
    // Listing Detail
    "listing.contact_owner": "Contact Owner",
    "listing.book_now": "Book Now",
    "listing.description": "Description",
    "listing.condition": "Condition",
    "listing.deposit": "Deposit",
    "listing.owner": "Owner",
    "listing.member_since": "Member since",
    "listing.reviews": "reviews",
    
    // Conditions
    "condition.new": "New",
    "condition.like_new": "Like New",
    "condition.good": "Good",
    "condition.fair": "Fair",
    
    // Booking
    "booking.select_dates": "Select Dates",
    "booking.start_date": "Start Date",
    "booking.end_date": "End Date",
    "booking.summary": "Summary",
    "booking.days": "days",
    "booking.subtotal": "Subtotal",
    "booking.service_fee": "Service Fee",
    "booking.deposit": "Security Deposit",
    "booking.total": "Total",
    "booking.confirm": "Confirm Booking",
    "booking.request_sent": "Request Sent",
    
    // Auth
    "auth.login": "Login",
    "auth.signup": "Sign Up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.confirm_password": "Confirm Password",
    "auth.display_name": "Display Name",
    "auth.forgot_password": "Forgot password?",
    "auth.no_account": "Don't have an account?",
    "auth.have_account": "Already have an account?",
    "auth.or": "or",
    "auth.continue_google": "Continue with Google",
    
    // Footer
    "footer.about": "About Us",
    "footer.help": "Help Center",
    "footer.terms": "Terms of Service",
    "footer.privacy": "Privacy",
    "footer.rights": "All rights reserved.",
    
    // Common
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.view": "View",
    "common.search": "Search",
    "common.close": "Close",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("it")
  const [categoryTranslations, setCategoryTranslations] = useState<Record<string, Record<Language, string>>>({})

  useEffect(() => {
    // Load language from localStorage
    const savedLang = localStorage.getItem("toolshare_language") as Language
    if (savedLang && (savedLang === "it" || savedLang === "en")) {
      setLanguageState(savedLang)
    } else {
      // Detect browser language
      const browserLang = navigator.language.slice(0, 2)
      if (browserLang === "it" || browserLang === "en") {
        setLanguageState(browserLang)
      }
    }

    // Load category translations from database
    loadCategoryTranslations()
  }, [])

  const loadCategoryTranslations = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("category_translations")
      .select("category_id, language_code, name")
    
    if (data) {
      const translations: Record<string, Record<Language, string>> = {}
      data.forEach((item: { category_id: string; language_code: string; name: string }) => {
        if (!translations[item.category_id]) {
          translations[item.category_id] = {} as Record<Language, string>
        }
        translations[item.category_id][item.language_code as Language] = item.name
      })
      setCategoryTranslations(translations)
    }
  }

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("toolshare_language", lang)
  }

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  const tCategory = (categoryId: string, fallback: string): string => {
    return categoryTranslations[categoryId]?.[language] || fallback
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tCategory }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
