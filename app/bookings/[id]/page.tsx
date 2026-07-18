import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { formatPrice, getRentalStatusLabel, getRentalStatusColor } from "@/lib/utils"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { BookingActions } from "@/components/bookings/booking-actions"
import { InitiateChat } from "@/components/chat/initiate-chat"
import { DbErrorNotice } from "@/components/ui/db-error-notice"
import {
  ChevronLeft, 
  Calendar, 
  User, 
  CreditCard,
  ImageIcon
} from "lucide-react"

interface BookingDetailPageProps {
  params: Promise<{ id: string }>
}

function getBookingPhase(orderStatus: string, itemStatus: string) {
  if (orderStatus === "pending" && itemStatus === "requested") {
    return { label: "Fase 1 - Richiesta inviata", color: "bg-amber-100 text-amber-800" }
  }
  if (orderStatus === "accepted" && itemStatus === "accepted") {
    return { label: "Fase 1 - Accettata, in attesa pagamento", color: "bg-emerald-100 text-emerald-800" }
  }
  if (orderStatus === "paid" && itemStatus === "paid") {
    return { label: "Fase 2 - Fondi autorizzati", color: "bg-indigo-100 text-indigo-800" }
  }
  if (orderStatus === "in_progress" && itemStatus === "collected") {
    return { label: "Fase 2 - Noleggio attivo", color: "bg-blue-100 text-blue-800" }
  }
  if (orderStatus === "completed" && itemStatus === "returned_ok") {
    return { label: "Fase 3 - Completato", color: "bg-emerald-100 text-emerald-800" }
  }
  if (orderStatus === "disputed" && itemStatus === "damaged") {
    return { label: "Fase 3 - Disputa aperta", color: "bg-orange-100 text-orange-800" }
  }
  if (orderStatus === "cancelled" && itemStatus === "cancelled") {
    return { label: "Prenotazione annullata", color: "bg-red-100 text-red-800" }
  }
  return { label: "Stato da verificare", color: "bg-slate-100 text-slate-800" }
}

function canRenderActions(orderStatus: string, itemStatus: string) {
  return (
    (orderStatus === "pending" && itemStatus === "requested") ||
    (orderStatus === "accepted" && itemStatus === "accepted") ||
    (orderStatus === "paid" && itemStatus === "paid") ||
    (orderStatus === "in_progress" && itemStatus === "collected")
  )
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirect=/bookings/${id}`)
  }

  // Fetch order and item separately to avoid fragile cross-schema embeds.
  const { data: order, error: orderError } = await supabase
    .schema("rentals_domain")
    .from("rental_orders")
    .select("*")
    .eq("id", id)
    .single()

  if (orderError || !order) {
    notFound()
  }

  const { data: item, error: itemError } = await supabase
    .schema("rentals_domain")
    .from("rental_items")
    .select("*")
    .eq("order_id", id)
    .single()

  if (itemError || !item) {
    notFound()
  }

  const isRenter = order.renter_id === user.id
  const isOwner = item.owner_id === user.id

  // Only allow access if user is renter or owner
  if (!isRenter && !isOwner) {
    notFound()
  }

  const dbErrors: string[] = []

  const { data: listingData, error: listingError } = await supabase
    .schema("inventory_domain")
    .from("listings")
    .select(`
      id,
      title,
      description,
      images:listing_images(image_url, display_order)
    `)
    .eq("id", item.listing_id)
    .single()
  if (listingError) dbErrors.push(`Annuncio: ${listingError.message}`)

  const { data: renterProfile, error: renterProfileError } = await supabase
    .schema("users_domain")
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .eq("id", order.renter_id)
    .maybeSingle()
  if (renterProfileError) dbErrors.push(`Profilo locatario: ${renterProfileError.message}`)

  const { data: ownerProfile, error: ownerProfileError } = await supabase
    .schema("users_domain")
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .eq("id", item.owner_id)
    .maybeSingle()
  if (ownerProfileError) dbErrors.push(`Profilo proprietario: ${ownerProfileError.message}`)

  const renter = (renterProfile || {
    id: order.renter_id,
    display_name: "Utente",
    avatar_url: null,
    email: "",
  }) as { id: string; display_name: string; avatar_url: string | null; email: string }

  const owner = (ownerProfile || {
    id: item.owner_id,
    display_name: "Utente",
    avatar_url: null,
    email: "",
  }) as { id: string; display_name: string; avatar_url: string | null; email: string }

  const listing = (listingData || {
    id: item.listing_id,
    title: "Annuncio rimosso",
    description: null,
    images: [],
  }) as { id: string; title: string; description: string | null; images: { image_url: string; display_order: number }[] }

  const mainImage = listing?.images?.sort((a, b) => a.display_order - b.display_order)[0]

  const otherParty = isRenter ? owner : renter
  const phase = getBookingPhase(order.status, item?.status || "")
  const showActions = canRenderActions(order.status, item?.status || "")

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <DbErrorNotice message={dbErrors.length ? dbErrors.join(" | ") : null} />
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link
          href="/bookings"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna ai noleggi
        </Link>

        {/* Status Banner */}
        <div className={`rounded-xl p-4 ${getRentalStatusColor(order.status)} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                Stato: {getRentalStatusLabel(order.status)}
              </p>
              <p className="mt-1 text-sm opacity-80">
                Ordine #{order.id.slice(0, 8)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${phase.color}`}>
                {phase.label}
              </span>
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getRentalStatusColor(order.status)}`}>
                Ordine: {getRentalStatusLabel(order.status)}
              </span>
              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getRentalStatusColor(item.status || "")}`}>
                Item: {getRentalStatusLabel(item.status || "-")}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Listing Info */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Attrezzo</h2>
            <div className="mt-4 flex gap-4">
              {mainImage ? (
                <img
                  src={mainImage.image_url}
                  alt={listing?.title || "Listing"}
                  className="h-24 w-24 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-muted">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                </div>
              )}
              <div className="flex-1">
                <Link
                  href={`/listings/${listing.id}`}
                  className="font-semibold text-foreground hover:text-primary"
                >
                  {listing.title || "Annuncio rimosso"}
                </Link>
                {listing.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {listing.description}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <InitiateChat
                rentalOrderId={id}
                currentUserId={user.id}
                otherUserId={otherParty.id}
                otherUserName={otherParty.display_name || "Utente"}
                variant="link"
                className="w-full"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Calendar className="h-5 w-5" />
              Periodo noleggio
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Data inizio</p>
                <p className="mt-1 font-medium text-foreground">
                  {format(new Date(item?.start_date), "EEEE d MMMM yyyy", { locale: it })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data fine</p>
                <p className="mt-1 font-medium text-foreground">
                  {format(new Date(item.end_date), "EEEE d MMMM yyyy", { locale: it })}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Durata: {item.total_days} {item.total_days === 1 ? "giorno" : "giorni"}
            </p>
          </div>

          {/* Payment Details */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <CreditCard className="h-5 w-5" />
              Dettagli pagamento
            </h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotale</span>
                <span className="text-foreground">{formatPrice(order.subtotal_cents, order.currency_code)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commissione servizio</span>
                <span className="text-foreground">{formatPrice(order.service_fee_cents, order.currency_code)}</span>
              </div>
              {order.total_deposit_cents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cauzione</span>
                  <span className="text-foreground">{formatPrice(order.total_deposit_cents, order.currency_code)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span className="text-foreground">Totale</span>
                <span className="text-foreground">{formatPrice(order.grand_total_cents, order.currency_code)}</span>
              </div>
            </div>
          </div>

          {/* Other Party */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <User className="h-5 w-5" />
              {isRenter ? "Proprietario" : "Noleggiatore"}
            </h2>
            <div className="mt-4 flex items-center gap-4">
              {otherParty?.avatar_url ? (
                <img
                  src={otherParty.avatar_url}
                  alt={otherParty.display_name || "Utente"}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground">
                  {(otherParty?.display_name || "U").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">
                  {otherParty?.display_name || "Utente"}
                </p>
                <p className="text-sm text-muted-foreground">{otherParty?.email}</p>
              </div>
            </div>
            <InitiateChat
              rentalOrderId={id}
              currentUserId={user.id}
              otherUserId={otherParty.id}
              otherUserName={otherParty.display_name || "Utente"}
              variant="link"
              className="w-full"
            />
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Note</h2>
              <p className="mt-2 text-muted-foreground">{order.notes}</p>
            </div>
          )}

          {/* Actions */}
          {showActions ? (
            <BookingActions
              orderId={order.id}
              itemId={item.id}
              currentStatus={order.status}
              itemStatus={item.status}
              isOwner={isOwner}
              isRenter={isRenter}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Azioni</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Nessuna azione disponibile in questa fase. Se lo stato sembra incoerente, aggiorna la pagina o contatta il supporto.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
