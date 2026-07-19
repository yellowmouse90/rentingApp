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
    "nav.notifications": "Notifiche",

    // Theme
    "theme.toggle": "Cambia tema",
    "theme.light": "Chiaro",
    "theme.dark": "Scuro",
    "theme.system": "Sistema",
    
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
    
    // Dashboard payments
    "dashboard.payments.quick_link": "Configura pagamenti",
    "dashboard.payments.title": "Configura i pagamenti",
    "dashboard.payments.subtitle": "Collega il tuo account Stripe e inizia a ricevere pagamenti dai noleggi.",
    "dashboard.payments.benefit1": "Ricevi pagamenti diretti e veloci",
    "dashboard.payments.benefit2": "Stripe gestisce pagamenti e depositi in modo sicuro",
    "dashboard.payments.benefit3": "Completa l'onboarding come venditore",
    "dashboard.payments.card.active_title": "Pagamenti attivi",
    "dashboard.payments.card.active_description": "Il tuo account Stripe è configurato. Ora puoi ricevere pagamenti per i tuoi noleggi.",
    "dashboard.payments.card.stripe_dashboard": "Apri Stripe Dashboard",
    "dashboard.payments.card.complete_title": "Completa la configurazione",
    "dashboard.payments.card.complete_description": "Hai iniziato il collegamento ma non hai ancora terminato l'onboarding Stripe.",
    "dashboard.payments.card.complete_button": "Completa configurazione",
    "dashboard.payments.card.setup_title": "Configura i pagamenti",
    "dashboard.payments.card.setup_description": "Per ricevere pagamenti dai tuoi noleggi, collega il tuo account Stripe in modo rapido e sicuro.",
    "dashboard.payments.card.setup_button": "Configura Stripe",
    "dashboard.payments.how_it_works_title": "Come funziona",
    "dashboard.payments.how_it_works_description": "Collega Stripe, completa l'onboarding e inizia a ricevere pagamenti dai tuoi affitti.",
    "dashboard.payments.how_it_works_step1": "Crea o collega il tuo account Stripe.",
    "dashboard.payments.how_it_works_step2": "Completa l'onboarding con i tuoi dati e il conto bancario.",
    "dashboard.payments.how_it_works_step3": "Inizia a ricevere pagamenti per i noleggi effettuati.",
    "dashboard.payments.back_to_dashboard": "Torna alla dashboard",
    
    // Footer extra
    "footer.description": "La piattaforma italiana per il noleggio di attrezzi tra privati. Risparmia denaro e riduci gli sprechi.",
    "footer.all_tools": "Tutti gli attrezzi",
    "footer.account": "Account",
    "footer.support": "Supporto",
    
    // How It Works page
    "how_it_works.title": "Come Funziona",
    "how_it_works.subtitle": "Scopri come noleggiare e mettere a reddito i tuoi attrezzi in pochi semplici step",
    "how_it_works.main_steps.title": "3 Semplici Step",
    
    // Search step
    "how_it_works.steps.search.title": "Cerca",
    "how_it_works.steps.search.description": "Trova l'attrezzo di cui hai bisogno tra migliaia di annunci vicino a te.",
    "how_it_works.steps.search.detail1": "Utilizza la barra di ricerca per trovare attrezzi specifici",
    "how_it_works.steps.search.detail2": "Filtra per categoria, prezzo e distanza",
    "how_it_works.steps.search.detail3": "Visualizza le immagini e le recensioni del proprietario",
    
    // Book step
    "how_it_works.steps.book.title": "Prenota",
    "how_it_works.steps.book.description": "Scegli le date e invia una richiesta di noleggio al proprietario.",
    "how_it_works.steps.book.detail1": "Seleziona le date di inizio e fine noleggio",
    "how_it_works.steps.book.detail2": "Visualizza il prezzo totale con cauzione inclusa",
    "how_it_works.steps.book.detail3": "Conferma la prenotazione con pagamento sicuro",
    
    // Rent step
    "how_it_works.steps.rent.title": "Usa e Restituisci",
    "how_it_works.steps.rent.description": "Ritira l'attrezzo, usalo per il tuo progetto e restituiscilo.",
    "how_it_works.steps.rent.detail1": "Ritira l'attrezzo direttamente dal proprietario",
    "how_it_works.steps.rent.detail2": "Usalo per tutto il periodo di noleggio",
    "how_it_works.steps.rent.detail3": "Restituiscilo in perfette condizioni e ricevi il rimborso della cauzione",
    
    // Benefits
    "how_it_works.benefits.title": "Perché Scegliere Toolshare",
    "how_it_works.benefits.subtitle": "I vantaggi di noleggiare e prestare attrezzi",
    "how_it_works.benefits.save_money.title": "Risparmia Denaro",
    "how_it_works.benefits.save_money.description": "Noleggia attrezzi costosi a frazione del prezzo di acquisto. Perfetto per progetti occasionali.",
    "how_it_works.benefits.secure.title": "Transazioni Sicure",
    "how_it_works.benefits.secure.description": "Pagamenti protetti da Stripe e depositi cauzionali rimborsabili per proteggere entrambe le parti.",
    "how_it_works.benefits.sustainable.title": "Sostenibile",
    "how_it_works.benefits.sustainable.description": "Riduci gli sprechi condividendo risorse con la tua community locale.",
    
    // Safety
    "how_it_works.safety.title": "Noleggio Sicuro e Affidabile",
    "how_it_works.safety.secure_payments.title": "Pagamenti Protetti",
    "how_it_works.safety.secure_payments.description": "Tutti i pagamenti sono processati da Stripe, la piattaforma leader per le transazioni online.",
    "how_it_works.safety.verified_users.title": "Utenti Verificati",
    "how_it_works.safety.verified_users.description": "I proprietari vengono verificati per garantire transazioni affidabili e sicure.",
    "how_it_works.safety.deposit_protection.title": "Protezione Cauzione",
    "how_it_works.safety.deposit_protection.description": "Le cauzioni vengono trattenute durante il noleggio e restituite dopo il ritorno dell'attrezzo.",
    "how_it_works.safety.reviews.title": "Recensioni Trasparenti",
    "how_it_works.safety.reviews.description": "Leggi le recensioni di altri utenti per fare scelte consapevoli.",
    
    // FAQ
    "how_it_works.faq.title": "Domande Frequenti",
    "how_it_works.faq.question1": "Quanto costa noleggiare un attrezzo?",
    "how_it_works.faq.answer1": "I prezzi variano a seconda dell'attrezzo e del proprietario. Puoi trovare i prezzi specifici consultando la pagina di dettaglio di ogni annuncio. Generalmente, noleggiare è molto più conveniente che comprare.",
    "how_it_works.faq.question2": "Cosa succede se l'attrezzo si rompe durante il noleggio?",
    "how_it_works.faq.answer2": "La cauzione è progettata per coprire eventuali danni. Se l'attrezzo viene danneggiato, la cauzione potrà essere utilizzata per le riparazioni. Contatta il proprietario immediatamente per segnalare il problema.",
    "how_it_works.faq.question3": "Come posso pubblicare i miei attrezzi?",
    "how_it_works.faq.answer3": "Accedi al tuo account, vai a Dashboard e clicca su 'Pubblica annuncio'. Compila i dettagli dell'attrezzo (titolo, descrizione, prezzo, foto) e pubblica. Il tuo annuncio sarà visibile subito.",
    "how_it_works.faq.question4": "E' sicuro incontrare uno sconosciuto?",
    "how_it_works.faq.answer4": "Si, tutti gli utenti sono verificati e puoi vedere le loro recensioni prima di accordarsi. Consigliamo sempre di incontrare in luoghi pubblici durante il giorno.",
    
    // CTA
    "how_it_works.cta.title": "Pronto a Iniziare?",
    "how_it_works.cta.subtitle": "Unisciti a migliaia di utenti che stanno già risparmiando denaro e guadagnando con Toolshare.",
    "how_it_works.cta.browse_button": "Sfoglia Annunci",
    "how_it_works.cta.publish_button": "Pubblica un Annuncio",

    // Listing edit page
    "listing_edit.load_error": "Non puoi modificare questo prodotto o il prodotto non esiste.",
    "listing_edit.geo_error": "Errore nella geolocalizzazione",
    "listing_edit.confirm_archive": "Vuoi archiviare questo prodotto? Verra rimosso dagli annunci pubblici.",
    "listing_edit.archive_error": "Errore durante l'archiviazione",
    "listing_edit.required_fields": "Compila tutti i campi obbligatori",
    "listing_edit.invalid_prices": "Prezzi non validi",
    "listing_edit.update_error": "Errore durante la modifica del prodotto. Riprova.",
    "listing_edit.back": "Torna ai tuoi prodotti",
    "listing_edit.title": "Modifica prodotto",
    "listing_edit.subtitle": "Aggiorna i dettagli del tuo prodotto. Solo il proprietario puo effettuare modifiche.",
    "listing_edit.field_title": "Titolo *",
    "listing_edit.title_placeholder": "es. Trapano Bosch Professional GSB 18V",
    "listing_edit.field_category": "Categoria",
    "listing_edit.category_placeholder": "Seleziona una categoria",
    "listing_edit.field_condition": "Condizione *",
    "listing_edit.select_condition": "Seleziona la condizione",
    "listing_edit.field_description": "Descrizione",
    "listing_edit.description_placeholder": "Descrivi il prodotto, eventuali accessori inclusi e consigli d'uso",
    "listing_edit.field_price_day": "Prezzo/giorno (€) *",
    "listing_edit.field_price_week": "Prezzo/settimana (€)",
    "listing_edit.field_deposit": "Cauzione (€)",
    "listing_edit.availability_title": "Disponibilita prodotto",
    "listing_edit.availability_desc": "Se disattivata, il prodotto resta pubblicato ma non prenotabile.",
    "listing_edit.update_location": "Aggiorna posizione",
    "listing_edit.remove_location": "Rimuovi posizione",
    "listing_edit.location_label": "Posizione:",
    "listing_edit.archive": "Archivia prodotto",
    "listing_edit.cancel": "Annulla",
    "listing_edit.save": "Salva modifiche",

    // Booking actions
    "booking_actions.update_error": "Errore durante l'aggiornamento",
    "booking_actions.update_error_retry": "Errore durante l'aggiornamento. Riprova.",
    "booking_actions.payment_creation_error": "Errore durante la creazione del pagamento",
    "booking_actions.payment_session_unavailable": "Sessione di pagamento non disponibile",
    "booking_actions.payment_error": "Errore durante il pagamento",
    "booking_actions.title": "Azioni",
    "booking_actions.approve": "Approva",
    "booking_actions.reject": "Rifiuta",
    "booking_actions.payment_title": "Pagamento",
    "booking_actions.owner_accepted": "Il proprietario ha accettato. Completa ora il pagamento per bloccare i fondi.",
    "booking_actions.pay_now": "Paga ora",
    "booking_actions.handover_hint": "Quando consegni l'attrezzo, segna il noleggio come iniziato.",
    "booking_actions.confirm_handover": "Conferma consegna",
    "booking_actions.describe_damage_prompt": "Descrivi il danno riscontrato",
    "booking_actions.return_hint": "Quando ricevi l'attrezzo indietro, scegli se e integro oppure danneggiato.",
    "booking_actions.returned_ok": "Restituito integro",
    "booking_actions.report_issue": "Segnala problema",
    "booking_actions.cancel_request": "Annulla richiesta",

    // Booking form
    "booking_form.dates_unavailable": "Le date selezionate non sono piu disponibili. Scegli un altro periodo.",
    "booking_form.booking_error": "Errore durante la prenotazione. Riprova.",
    "booking_form.payment_unavailable_title": "Pagamento non disponibile",
    "booking_form.payment_unavailable_desc": "Il proprietario non ha ancora configurato i pagamenti. La prenotazione verra inviata come richiesta e dovrai concordare il pagamento direttamente.",
    "booking_form.message_label": "Messaggio per il proprietario (opzionale)",
    "booking_form.message_placeholder": "Presentati e spiega per cosa ti serve l'attrezzo...",
    "booking_form.terms_title": "Termini del noleggio",
    "booking_form.term1": "Ritiro e consegna da concordare con il proprietario",
    "booking_form.term2": "L'attrezzo deve essere restituito nelle stesse condizioni",
    "booking_form.term3": "La cauzione viene rimborsata dopo la restituzione",
    "booking_form.term4": "Cancellazione gratuita fino a 24 ore prima",
    "booking_form.processing": "Elaborazione...",
    "booking_form.submit": "Invia richiesta di noleggio",
    "booking_form.disclaimer_prefix": "Cliccando il pulsante accetti i",
    "booking_form.disclaimer_terms": "Termini di Servizio",
    "booking_form.disclaimer_and": "e la",

    // Location search
    "location_search.geo_error": "Errore nella geolocalizzazione",
    "location_search.address_not_found": "Indirizzo non trovato. Prova con un altro indirizzo.",
    "location_search.address_search_error": "Errore nella ricerca dell'indirizzo",
    "location_search.title": "Posizione",
    "location_search.radius": "Raggio di ricerca",
    "location_search.update_location": "Aggiorna posizione",
    "location_search.use_my_location": "Usa la mia posizione",
    "location_search.hide": "Nascondi",
    "location_search.enter_manually": "Inserisci manualmente",
    "location_search.address_placeholder": "Inserisci citta o indirizzo...",
    "location_search.search": "Cerca",

    // Booking card extras
    "booking.card.manage_listing": "Gestione annuncio",
    "booking.card.go_to_your_listings": "Vai ai tuoi annunci",
    "booking.card.weekday_mon": "Lu",
    "booking.card.weekday_tue": "Ma",
    "booking.card.weekday_wed": "Me",
    "booking.card.weekday_thu": "Gi",
    "booking.card.weekday_fri": "Ve",
    "booking.card.weekday_sat": "Sa",
    "booking.card.weekday_sun": "Do",
    "booking.card.total_to_pay": "Totale noleggio da pagare",
    "booking.card.deposit_separate": "Caparra separata:",
    "booking.card.total_authorized": "Importo totale autorizzato sulla carta:",

    // Booking success handler
    "booking_success_handler.not_confirmed": "Pagamento non ancora confermato",
    "booking_success_handler.confirmed": "Pagamento autorizzato con successo",
    "booking_success_handler.confirm_error": "Errore durante la conferma del pagamento",

    // Chat
    "chat.default_user": "Utente",
    "chat.load_messages_error": "Errore nel caricamento dei messaggi",
    "chat.send_message_error": "Errore nell'invio del messaggio",
    "chat.loading_conversation": "Caricamento conversazione...",
    "chat.message_placeholder": "Scrivi un messaggio...",
    "chat.load_conversations_error": "Errore nel caricamento delle conversazioni",
    "chat.login_required": "Effettua l'accesso per visualizzare i messaggi",
    "chat.title": "Messaggi",
    "chat.no_conversation": "Nessuna conversazione",
    "chat.select_conversation": "Seleziona una conversazione",
    "chat.start_new_from_order": "Inizia una nuova conversazione da un ordine",
    "chat.click_to_start": "Clicca su una conversazione per iniziare",
    "chat.close": "Chiudi",
    "chat.loading": "Caricamento...",
    "chat.items_count": "oggetti",
    "chat.no_messages_short": "Nessun messaggio",
    "chat.today": "Oggi",
    "chat.send_message_to": "Invia messaggio a",
    "chat.send_message": "Invia messaggio",
    "chat.ctrl_enter_hint": "Ctrl + Enter per inviare",
    "chat.no_messages_yet": "Non ci sono ancora messaggi",
    "chat.start_conversation_with": "Inizia la conversazione con",
    "chat.this_user": "questo utente",
    "chat.you": "Tu",
    "chat.back": "Indietro",
    "chat.load_older_messages": "Carica messaggi precedenti",
    "chat.loading_older_messages": "Caricamento...",
    "chat.deleted_user": "Utente eliminato",

    // Misc
    "auth.invalid_credentials": "Email o password non corretti",
    "common.close_notification": "Chiudi notifica",

    // Listing gallery
    "listing_gallery.no_image": "Nessuna immagine",
    "listing_gallery.image_alt": "Immagine",
    "listing_gallery.thumbnail_alt": "Miniatura",

    // Stripe connect card extras
    "dashboard.payments.card.error_status": "Errore",
    "dashboard.payments.card.setup_error": "Errore durante la configurazione. Riprova.",

    // Listings grid (browse page)
    "listings_grid.results_count": "risultati",
    "listings_grid.within": "entro",
    "listings_grid.km_from": "km da",
    "listings_grid.no_results": "Nessun risultato",
    "listings_grid.no_results_with_location": "Prova ad aumentare il raggio di ricerca o a modificare i filtri",
    "listings_grid.no_results_no_location": "Abilita la geolocalizzazione per vedere gli attrezzi vicino a te",
    "listings_grid.view_all": "Vedi tutti gli annunci",
    "listings_grid.per_week": "/settimana",

    // Rental statuses
    "rental_status.pending": "In attesa",
    "rental_status.approved": "Approvato",
    "rental_status.accepted": "Accettato",
    "rental_status.paid": "Pagato",
    "rental_status.in_progress": "In noleggio",
    "rental_status.ongoing": "In corso",
    "rental_status.completed": "Completato",
    "rental_status.cancelled": "Annullato",
    "rental_status.disputed": "Contestato",
    "rental_status.requested": "Richiesto",
    "rental_status.unavailable": "Non disponibile",
    "rental_status.collected": "Consegnato",
    "rental_status.returned_ok": "Restituito integro",
    "rental_status.damaged": "Danneggiato",

    // Notifications bell + preferences
    "notifications.title": "Notifiche",
    "notifications.empty": "Nessuna notifica",
    "notifications.mark_all_read": "Segna tutte come lette",
    "notifications.prefs.load_error": "Errore nel caricamento delle preferenze",
    "notifications.prefs.save_error": "Errore nel salvataggio della preferenza",
    "notifications.prefs.channel_none": "Niente",
    "notifications.prefs.channel_in_app": "In-app",
    "notifications.prefs.channel_email": "Email",
    "notifications.prefs.section_bookings": "Prenotazioni",
    "notifications.prefs.section_payments": "Pagamenti",
    "notifications.types.booking_accepted": "Prenotazione accettata",
    "notifications.types.booking_rejected": "Prenotazione rifiutata",
    "notifications.types.booking_cancelled_by_renter": "Prenotazione annullata dal noleggiatore",
    "notifications.types.booking_handover_confirmed": "Consegna confermata",
    "notifications.types.booking_returned_ok": "Noleggio completato",
    "notifications.types.booking_damage_reported": "Danno segnalato",
    "notifications.types.payment_succeeded": "Pagamento riuscito",
    "notifications.types.payment_failed": "Pagamento non riuscito",
    "notifications.types.stripe_onboarding_complete": "Configurazione pagamenti completata",
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
    "nav.notifications": "Notifications",

    // Theme
    "theme.toggle": "Toggle theme",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.system": "System",
    
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
    
    // Dashboard payments
    "dashboard.payments.quick_link": "Configure payments",
    "dashboard.payments.title": "Configure payments",
    "dashboard.payments.subtitle": "Connect your Stripe account and start receiving rental payments.",
    "dashboard.payments.benefit1": "Receive fast direct payouts",
    "dashboard.payments.benefit2": "Stripe handles payments and deposits securely",
    "dashboard.payments.benefit3": "Complete onboarding as a seller",
    "dashboard.payments.card.active_title": "Payments Active",
    "dashboard.payments.card.active_description": "Your Stripe account is configured. You can now receive payments for rentals.",
    "dashboard.payments.card.stripe_dashboard": "Open Stripe Dashboard",
    "dashboard.payments.card.complete_title": "Complete setup",
    "dashboard.payments.card.complete_description": "You started connecting but haven’t finished Stripe onboarding yet.",
    "dashboard.payments.card.complete_button": "Complete setup",
    "dashboard.payments.card.setup_title": "Set up payments",
    "dashboard.payments.card.setup_description": "To receive rental payments, connect your Stripe account quickly and securely.",
    "dashboard.payments.card.setup_button": "Connect Stripe",
    "dashboard.payments.how_it_works_title": "How it works",
    "dashboard.payments.how_it_works_description": "Connect Stripe, complete onboarding, and start receiving payments for your rentals.",
    "dashboard.payments.how_it_works_step1": "Create or connect your Stripe account.",
    "dashboard.payments.how_it_works_step2": "Complete onboarding with your details and bank account.",
    "dashboard.payments.how_it_works_step3": "Start receiving payments for completed rentals.",
    "dashboard.payments.back_to_dashboard": "Back to dashboard",
    
    // Footer extra
    "footer.description": "The Italian platform for peer-to-peer tool rental. Save money and reduce waste.",
    "footer.all_tools": "All tools",
    "footer.account": "Account",
    "footer.support": "Support",
    
    // How It Works page
    "how_it_works.title": "How It Works",
    "how_it_works.subtitle": "Discover how to rent and earn money from your tools in a few simple steps",
    "how_it_works.main_steps.title": "3 Simple Steps",
    
    // Search step
    "how_it_works.steps.search.title": "Search",
    "how_it_works.steps.search.description": "Find the tool you need among thousands of listings near you.",
    "how_it_works.steps.search.detail1": "Use the search bar to find specific tools",
    "how_it_works.steps.search.detail2": "Filter by category, price and distance",
    "how_it_works.steps.search.detail3": "View images and the owner's reviews",
    
    // Book step
    "how_it_works.steps.book.title": "Book",
    "how_it_works.steps.book.description": "Choose the dates and send a rental request to the owner.",
    "how_it_works.steps.book.detail1": "Select the start and end dates for your rental",
    "how_it_works.steps.book.detail2": "View the total price with deposit included",
    "how_it_works.steps.book.detail3": "Confirm the booking with secure payment",
    
    // Rent step
    "how_it_works.steps.rent.title": "Use and Return",
    "how_it_works.steps.rent.description": "Pick up the tool, use it for your project and return it.",
    "how_it_works.steps.rent.detail1": "Pick up the tool directly from the owner",
    "how_it_works.steps.rent.detail2": "Use it throughout the rental period",
    "how_it_works.steps.rent.detail3": "Return it in perfect condition and receive your deposit refund",
    
    // Benefits
    "how_it_works.benefits.title": "Why Choose Toolshare",
    "how_it_works.benefits.subtitle": "The benefits of renting and lending tools",
    "how_it_works.benefits.save_money.title": "Save Money",
    "how_it_works.benefits.save_money.description": "Rent expensive tools at a fraction of the purchase price. Perfect for occasional projects.",
    "how_it_works.benefits.secure.title": "Secure Transactions",
    "how_it_works.benefits.secure.description": "Payments protected by Stripe and refundable security deposits to protect both parties.",
    "how_it_works.benefits.sustainable.title": "Sustainable",
    "how_it_works.benefits.sustainable.description": "Reduce waste by sharing resources with your local community.",
    
    // Safety
    "how_it_works.safety.title": "Safe and Reliable Rental",
    "how_it_works.safety.secure_payments.title": "Protected Payments",
    "how_it_works.safety.secure_payments.description": "All payments are processed by Stripe, the leading platform for online transactions.",
    "how_it_works.safety.verified_users.title": "Verified Users",
    "how_it_works.safety.verified_users.description": "Owners are verified to ensure reliable and secure transactions.",
    "how_it_works.safety.deposit_protection.title": "Deposit Protection",
    "how_it_works.safety.deposit_protection.description": "Deposits are held during the rental and returned after the tool is returned.",
    "how_it_works.safety.reviews.title": "Transparent Reviews",
    "how_it_works.safety.reviews.description": "Read reviews from other users to make informed choices.",
    
    // FAQ
    "how_it_works.faq.title": "Frequently Asked Questions",
    "how_it_works.faq.question1": "How much does it cost to rent a tool?",
    "how_it_works.faq.answer1": "Prices vary depending on the tool and owner. You can find specific prices on each listing's detail page. Generally, renting is much more affordable than buying.",
    "how_it_works.faq.question2": "What if the tool breaks during the rental?",
    "how_it_works.faq.answer2": "The deposit is designed to cover any damage. If the tool gets damaged, the deposit can be used for repairs. Contact the owner immediately to report the issue.",
    "how_it_works.faq.question3": "How can I publish my tools?",
    "how_it_works.faq.answer3": "Log in to your account, go to Dashboard and click 'Publish listing'. Fill in the tool details (title, description, price, photos) and publish. Your listing will be visible immediately.",
    "how_it_works.faq.question4": "Is it safe to meet a stranger?",
    "how_it_works.faq.answer4": "Yes, all users are verified and you can see their reviews before agreeing. We recommend always meeting in public places during the day.",
    
    // CTA
    "how_it_works.cta.title": "Ready to Get Started?",
    "how_it_works.cta.subtitle": "Join thousands of users who are already saving money and earning with Toolshare.",
    "how_it_works.cta.browse_button": "Browse Listings",
    "how_it_works.cta.publish_button": "Publish a Listing",

    // Listing edit page
    "listing_edit.load_error": "You cannot edit this product, or it does not exist.",
    "listing_edit.geo_error": "Geolocation error",
    "listing_edit.confirm_archive": "Do you want to archive this product? It will be removed from public listings.",
    "listing_edit.archive_error": "Error while archiving",
    "listing_edit.required_fields": "Fill in all required fields",
    "listing_edit.invalid_prices": "Invalid prices",
    "listing_edit.update_error": "Error while updating the product. Please try again.",
    "listing_edit.back": "Back to your products",
    "listing_edit.title": "Edit product",
    "listing_edit.subtitle": "Update your product's details. Only the owner can make changes.",
    "listing_edit.field_title": "Title *",
    "listing_edit.title_placeholder": "e.g. Bosch Professional GSB 18V Drill",
    "listing_edit.field_category": "Category",
    "listing_edit.category_placeholder": "Select a category",
    "listing_edit.field_condition": "Condition *",
    "listing_edit.select_condition": "Select condition",
    "listing_edit.field_description": "Description",
    "listing_edit.description_placeholder": "Describe the product, any included accessories and usage tips",
    "listing_edit.field_price_day": "Price/day (€) *",
    "listing_edit.field_price_week": "Price/week (€)",
    "listing_edit.field_deposit": "Deposit (€)",
    "listing_edit.availability_title": "Product availability",
    "listing_edit.availability_desc": "If disabled, the product stays published but cannot be booked.",
    "listing_edit.update_location": "Update location",
    "listing_edit.remove_location": "Remove location",
    "listing_edit.location_label": "Location:",
    "listing_edit.archive": "Archive product",
    "listing_edit.cancel": "Cancel",
    "listing_edit.save": "Save changes",

    // Booking actions
    "booking_actions.update_error": "Error while updating",
    "booking_actions.update_error_retry": "Error while updating. Please try again.",
    "booking_actions.payment_creation_error": "Error while creating the payment",
    "booking_actions.payment_session_unavailable": "Payment session unavailable",
    "booking_actions.payment_error": "Error during payment",
    "booking_actions.title": "Actions",
    "booking_actions.approve": "Approve",
    "booking_actions.reject": "Decline",
    "booking_actions.payment_title": "Payment",
    "booking_actions.owner_accepted": "The owner has accepted. Complete the payment now to secure the funds.",
    "booking_actions.pay_now": "Pay now",
    "booking_actions.handover_hint": "When you hand over the tool, mark the rental as started.",
    "booking_actions.confirm_handover": "Confirm handover",
    "booking_actions.describe_damage_prompt": "Describe the damage found",
    "booking_actions.return_hint": "When you get the tool back, mark it as returned in good condition or damaged.",
    "booking_actions.returned_ok": "Returned in good condition",
    "booking_actions.report_issue": "Report an issue",
    "booking_actions.cancel_request": "Cancel request",

    // Booking form
    "booking_form.dates_unavailable": "The selected dates are no longer available. Please choose another period.",
    "booking_form.booking_error": "Error while booking. Please try again.",
    "booking_form.payment_unavailable_title": "Payment unavailable",
    "booking_form.payment_unavailable_desc": "The owner hasn't set up payments yet. Your booking will be sent as a request and you'll need to arrange payment directly.",
    "booking_form.message_label": "Message for the owner (optional)",
    "booking_form.message_placeholder": "Introduce yourself and explain what you need the tool for...",
    "booking_form.terms_title": "Rental terms",
    "booking_form.term1": "Pickup and return to be arranged with the owner",
    "booking_form.term2": "The tool must be returned in the same condition",
    "booking_form.term3": "The deposit is refunded after the return",
    "booking_form.term4": "Free cancellation up to 24 hours before",
    "booking_form.processing": "Processing...",
    "booking_form.submit": "Send rental request",
    "booking_form.disclaimer_prefix": "By clicking the button you accept our",
    "booking_form.disclaimer_terms": "Terms of Service",
    "booking_form.disclaimer_and": "and",

    // Location search
    "location_search.geo_error": "Geolocation error",
    "location_search.address_not_found": "Address not found. Try a different address.",
    "location_search.address_search_error": "Error while searching for the address",
    "location_search.title": "Location",
    "location_search.radius": "Search radius",
    "location_search.update_location": "Update location",
    "location_search.use_my_location": "Use my location",
    "location_search.hide": "Hide",
    "location_search.enter_manually": "Enter manually",
    "location_search.address_placeholder": "Enter a city or address...",
    "location_search.search": "Search",

    // Booking card extras
    "booking.card.manage_listing": "Manage listing",
    "booking.card.go_to_your_listings": "Go to your listings",
    "booking.card.weekday_mon": "Mo",
    "booking.card.weekday_tue": "Tu",
    "booking.card.weekday_wed": "We",
    "booking.card.weekday_thu": "Th",
    "booking.card.weekday_fri": "Fr",
    "booking.card.weekday_sat": "Sa",
    "booking.card.weekday_sun": "Su",
    "booking.card.total_to_pay": "Total to pay now",
    "booking.card.deposit_separate": "Separate deposit:",
    "booking.card.total_authorized": "Total amount authorized on card:",

    // Booking success handler
    "booking_success_handler.not_confirmed": "Payment not yet confirmed",
    "booking_success_handler.confirmed": "Payment authorized successfully",
    "booking_success_handler.confirm_error": "Error while confirming the payment",

    // Chat
    "chat.default_user": "User",
    "chat.load_messages_error": "Error while loading messages",
    "chat.send_message_error": "Error while sending the message",
    "chat.loading_conversation": "Loading conversation...",
    "chat.message_placeholder": "Write a message...",
    "chat.load_conversations_error": "Error while loading conversations",
    "chat.login_required": "Log in to view your messages",
    "chat.title": "Messages",
    "chat.no_conversation": "No conversation",
    "chat.select_conversation": "Select a conversation",
    "chat.start_new_from_order": "Start a new conversation from an order",
    "chat.click_to_start": "Click on a conversation to get started",
    "chat.close": "Close",
    "chat.loading": "Loading...",
    "chat.items_count": "items",
    "chat.no_messages_short": "No messages",
    "chat.today": "Today",
    "chat.send_message_to": "Message",
    "chat.send_message": "Send message",
    "chat.ctrl_enter_hint": "Ctrl + Enter to send",
    "chat.no_messages_yet": "There are no messages yet",
    "chat.start_conversation_with": "Start the conversation with",
    "chat.this_user": "this user",
    "chat.you": "You",
    "chat.back": "Back",
    "chat.load_older_messages": "Load older messages",
    "chat.loading_older_messages": "Loading...",
    "chat.deleted_user": "Deleted user",

    // Misc
    "auth.invalid_credentials": "Incorrect email or password",
    "common.close_notification": "Close notification",

    // Listing gallery
    "listing_gallery.no_image": "No image",
    "listing_gallery.image_alt": "Image",
    "listing_gallery.thumbnail_alt": "Thumbnail",

    // Stripe connect card extras
    "dashboard.payments.card.error_status": "Error",
    "dashboard.payments.card.setup_error": "Error during setup. Please try again.",

    // Listings grid (browse page)
    "listings_grid.results_count": "results",
    "listings_grid.within": "within",
    "listings_grid.km_from": "km of",
    "listings_grid.no_results": "No results",
    "listings_grid.no_results_with_location": "Try increasing the search radius or changing filters",
    "listings_grid.no_results_no_location": "Enable geolocation to see tools near you",
    "listings_grid.view_all": "View all listings",
    "listings_grid.per_week": "/week",

    // Rental statuses
    "rental_status.pending": "Pending",
    "rental_status.approved": "Approved",
    "rental_status.accepted": "Accepted",
    "rental_status.paid": "Paid",
    "rental_status.in_progress": "In progress",
    "rental_status.ongoing": "Ongoing",
    "rental_status.completed": "Completed",
    "rental_status.cancelled": "Cancelled",
    "rental_status.disputed": "Disputed",
    "rental_status.requested": "Requested",
    "rental_status.unavailable": "Unavailable",
    "rental_status.collected": "Collected",
    "rental_status.returned_ok": "Returned in good condition",
    "rental_status.damaged": "Damaged",

    // Notifications bell + preferences
    "notifications.title": "Notifications",
    "notifications.empty": "No notifications",
    "notifications.mark_all_read": "Mark all as read",
    "notifications.prefs.load_error": "Error loading preferences",
    "notifications.prefs.save_error": "Error saving preference",
    "notifications.prefs.channel_none": "None",
    "notifications.prefs.channel_in_app": "In-app",
    "notifications.prefs.channel_email": "Email",
    "notifications.prefs.section_bookings": "Bookings",
    "notifications.prefs.section_payments": "Payments",
    "notifications.types.booking_accepted": "Booking accepted",
    "notifications.types.booking_rejected": "Booking rejected",
    "notifications.types.booking_cancelled_by_renter": "Booking cancelled by renter",
    "notifications.types.booking_handover_confirmed": "Handover confirmed",
    "notifications.types.booking_returned_ok": "Rental completed",
    "notifications.types.booking_damage_reported": "Damage reported",
    "notifications.types.payment_succeeded": "Payment succeeded",
    "notifications.types.payment_failed": "Payment failed",
    "notifications.types.stripe_onboarding_complete": "Payment setup complete",
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

