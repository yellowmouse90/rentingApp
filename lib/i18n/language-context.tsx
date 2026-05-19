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
    "listings.filters.title": "Filtri",
    "listings.filters.sort": "Ordina per",
    "listings.filters.sort.newest": "Piu recenti",
    "listings.filters.sort.oldest": "Meno recenti",
    "listings.filters.sort.price_asc": "Prezzo crescente",
    "listings.filters.sort.price_desc": "Prezzo decrescente",
    "listings.filters.clear": "Rimuovi filtri",
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
    "booking.card.owner_notice": "Questo e il tuo annuncio. Non puoi prenotarlo.",
    "booking.card.edit_listing": "Modifica annuncio",
    "booking.card.selected": "Selezionato",
    "booking.card.unavailable": "Non disponibile",
    "booking.card.day": "giorno",
    "booking.card.deposit_refundable": "Cauzione (rimborsabile)",
    "booking.card.login_to_book": "Accedi per prenotare",
    
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
    "auth.password_min_length": "La password deve essere di almeno 6 caratteri",
    "auth.terms_agreement": "Registrandoti accetti i nostri",
    
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
    "common.user": "Utente",
    "listing.actions.confirm_archive": "Vuoi archiviare questo prodotto? Verra rimosso dagli annunci pubblici.",
    "listing.actions.archive_error": "Errore durante l'archiviazione",
    "listing.actions.details": "Dettagli",
    "listing.actions.archive": "Archivia",
    "listing.actions.already_archived": "Gia archiviato",
    
    // Navigation
    "nav.explore": "Esplora",
    "nav.categories": "Categorie",
    "nav.publish_listing": "Pubblica annuncio",
    "nav.my_rentals": "I miei noleggi",
    "nav.settings": "Impostazioni",
    "nav.open_menu": "Apri menu",
    "nav.close_menu": "Chiudi menu",
    
    // Homepage extra
    "home.hero.search_example": "Cerca un attrezzo... (es. trapano, tagliaerba)",
    "home.hero.secure_payments": "Pagamenti sicuri",
    "home.hero.immediate_availability": "Disponibilita immediata",
    "home.hero.guaranteed_savings": "Risparmio garantito",
    "home.categories.subtitle": "Trova l'attrezzo giusto per ogni lavoro",
    "home.categories.all": "Tutte le categorie",
    "home.featured.subtitle": "Gli ultimi attrezzi aggiunti dalla community",
    "home.featured.view_all": "Vedi tutti",
    "home.featured.view_all_listings": "Vedi tutti gli annunci",
    "home.how.subtitle": "Noleggiare e semplice, sicuro e veloce",
    "home.how.step2.desc_full": "Scegli le date, contatta il proprietario e conferma il noleggio",
    "home.how.step3.title_full": "Usa e restituisci",
    "home.how.step3.desc_full": "Ritira l'attrezzo, usalo per il tuo progetto e restituiscilo",
    "home.how.start_renting": "Inizia a noleggiare",
    "home.cta.subtitle_full": "Mettili a reddito! Guadagna condividendo i tuoi attrezzi con chi ne ha bisogno.",
    "home.cta.publish_first": "Pubblica il tuo primo annuncio",

    // New listing page
    "listing.new.back": "Torna agli annunci",
    "listing.new.title": "Pubblica un annuncio",
    "listing.new.subtitle": "Compila i dettagli del tuo attrezzo per metterlo a noleggio",
    "listing.new.fields.title": "Titolo",
    "listing.new.fields.title_placeholder": "es. Trapano Bosch Professional GSB 18V",
    "listing.new.fields.category_placeholder": "Seleziona una categoria",
    "listing.new.category.no_options": "Nessuna categoria trovata",
    "listing.new.fields.description": "Descrizione",
    "listing.new.fields.description_placeholder": "Descrivi il tuo attrezzo, le sue caratteristiche e condizioni...",
    "listing.new.fields.price_day": "Prezzo/giorno",
    "listing.new.fields.price_week": "Prezzo/settimana",
    "listing.new.fields.deposit": "Cauzione",
    "listing.new.condition.new.desc": "Mai usato, ancora imballato",
    "listing.new.condition.like_new.desc": "Usato pochissimo, perfette condizioni",
    "listing.new.condition.good.desc": "Usato con cura, funziona perfettamente",
    "listing.new.condition.fair.desc": "Segni di usura ma funzionante",
    "listing.new.images.title": "Immagini (max 5)",
    "listing.new.images.upload": "Carica",
    "listing.new.images.hint": "Formati supportati: JPG, PNG, WebP. Max 5MB per immagine.",
    "listing.new.location.title": "Posizione dell'attrezzo",
    "listing.new.location.update": "Aggiorna posizione",
    "listing.new.location.use_current": "Usa la mia posizione attuale",
    "listing.new.location.help": "La posizione aiuta gli utenti a trovare attrezzi vicino a loro",
    "listing.new.submit.loading": "Pubblicazione...",
    "listing.new.submit.idle": "Pubblica annuncio",
    "listing.new.errors.max_images": "Puoi caricare massimo 5 immagini",
    "listing.new.errors.required": "Compila tutti i campi obbligatori",
    "listing.new.errors.invalid_daily_price": "Il prezzo giornaliero deve essere maggiore di zero",
    "listing.new.errors.invalid_weekly_price": "Prezzo settimanale non valido",
    "listing.new.errors.invalid_deposit": "Cauzione non valida",
    "listing.new.errors.invalid_prices": "Prezzi non validi",
    "listing.new.errors.create_failed": "Errore durante la creazione dell'annuncio. Riprova.",
    "location.geo_denied_short": "Accesso alla posizione negato",
    
    // Footer extra
    "footer.description": "La piattaforma italiana per il noleggio di attrezzi tra privati. Risparmia denaro e riduci gli sprechi.",
    "footer.all_tools": "Tutti gli attrezzi",
    "footer.account": "Account",
    "footer.support": "Supporto",
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
    "listings.filters.title": "Filters",
    "listings.filters.sort": "Sort by",
    "listings.filters.sort.newest": "Newest first",
    "listings.filters.sort.oldest": "Oldest first",
    "listings.filters.sort.price_asc": "Price low to high",
    "listings.filters.sort.price_desc": "Price high to low",
    "listings.filters.clear": "Clear filters",
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
    "booking.card.owner_notice": "This is your listing. You cannot book it.",
    "booking.card.edit_listing": "Edit listing",
    "booking.card.selected": "Selected",
    "booking.card.unavailable": "Unavailable",
    "booking.card.day": "day",
    "booking.card.deposit_refundable": "Deposit (refundable)",
    "booking.card.login_to_book": "Log in to book",
    
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
    "auth.password_min_length": "Password must be at least 6 characters",
    "auth.terms_agreement": "By signing up, you agree to our",
    
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
    "common.user": "User",
    "listing.actions.confirm_archive": "Do you want to archive this product? It will be removed from public listings.",
    "listing.actions.archive_error": "Error while archiving",
    "listing.actions.details": "Details",
    "listing.actions.archive": "Archive",
    "listing.actions.already_archived": "Already archived",
    
    // Navigation
    "nav.explore": "Explore",
    "nav.categories": "Categories",
    "nav.publish_listing": "Publish listing",
    "nav.my_rentals": "My rentals",
    "nav.settings": "Settings",
    "nav.open_menu": "Open menu",
    "nav.close_menu": "Close menu",
    
    // Homepage extra
    "home.hero.search_example": "Search for a tool... (e.g. drill, lawnmower)",
    "home.hero.secure_payments": "Secure payments",
    "home.hero.immediate_availability": "Immediate availability",
    "home.hero.guaranteed_savings": "Guaranteed savings",
    "home.categories.subtitle": "Find the right tool for every job",
    "home.categories.all": "All categories",
    "home.featured.subtitle": "The latest tools added by the community",
    "home.featured.view_all": "View all",
    "home.featured.view_all_listings": "View all listings",
    "home.how.subtitle": "Renting is simple, safe and fast",
    "home.how.step2.desc_full": "Choose the dates, contact the owner and confirm the rental",
    "home.how.step3.title_full": "Use and return",
    "home.how.step3.desc_full": "Pick up the tool, use it for your project and return it",
    "home.how.start_renting": "Start renting",
    "home.cta.subtitle_full": "Put them to work! Earn money by sharing your tools with those who need them.",
    "home.cta.publish_first": "Publish your first listing",

    // New listing page
    "listing.new.back": "Back to listings",
    "listing.new.title": "Publish a listing",
    "listing.new.subtitle": "Fill in your tool details to make it available for rent",
    "listing.new.fields.title": "Title",
    "listing.new.fields.title_placeholder": "e.g. Bosch Professional GSB 18V Drill",
    "listing.new.fields.category_placeholder": "Select a category",
    "listing.new.category.no_options": "No categories found",
    "listing.new.fields.description": "Description",
    "listing.new.fields.description_placeholder": "Describe your tool, its features and condition...",
    "listing.new.fields.price_day": "Price/day",
    "listing.new.fields.price_week": "Price/week",
    "listing.new.fields.deposit": "Deposit",
    "listing.new.condition.new.desc": "Never used, still boxed",
    "listing.new.condition.like_new.desc": "Used very little, excellent condition",
    "listing.new.condition.good.desc": "Used with care, works perfectly",
    "listing.new.condition.fair.desc": "Visible wear but fully working",
    "listing.new.images.title": "Images (max 5)",
    "listing.new.images.upload": "Upload",
    "listing.new.images.hint": "Supported formats: JPG, PNG, WebP. Max 5MB per image.",
    "listing.new.location.title": "Tool location",
    "listing.new.location.update": "Update location",
    "listing.new.location.use_current": "Use my current location",
    "listing.new.location.help": "Location helps users find tools near them",
    "listing.new.submit.loading": "Publishing...",
    "listing.new.submit.idle": "Publish listing",
    "listing.new.errors.max_images": "You can upload up to 5 images",
    "listing.new.errors.required": "Fill in all required fields",
    "listing.new.errors.invalid_daily_price": "Daily price must be greater than zero",
    "listing.new.errors.invalid_weekly_price": "Invalid weekly price",
    "listing.new.errors.invalid_deposit": "Invalid deposit",
    "listing.new.errors.invalid_prices": "Invalid prices",
    "listing.new.errors.create_failed": "Error while creating listing. Please try again.",
    "location.geo_denied_short": "Location access denied",
    
    // Footer extra
    "footer.description": "The Italian platform for peer-to-peer tool rental. Save money and reduce waste.",
    "footer.all_tools": "All tools",
    "footer.account": "Account",
    "footer.support": "Support",
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
      .schema("inventory_domain")
      .from("category_translations")
      .select("category_id, language_code, name")
      .in("language_code", ["it", "en"])
    
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
    document.cookie = `toolshare_language=${lang}; path=/; max-age=31536000; samesite=lax`
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
