"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { format, addDays, eachDayOfInterval, isSameDay, isAfter, isBefore, startOfDay } from "date-fns"
import { it } from "date-fns/locale"
import type { Listing } from "@/lib/types"
import { formatPrice, calculateDays, calculateRentalPrice, calculateServiceFee } from "@/lib/utils"
import { Calendar, ChevronLeft, ChevronRight, Info, Settings, Package } from "lucide-react"

interface BookingCardProps {
  listing: Listing
  bookings: { start_date: string; end_date: string; status: string }[]
  exceptions: { unavailable_date: string }[]
  isOwner: boolean
  isLoggedIn: boolean
}

export function BookingCard({ listing, bookings, exceptions, isOwner, isLoggedIn }: BookingCardProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isSelectingEnd, setIsSelectingEnd] = useState(false)

  // Calculate unavailable dates
  const unavailableDates = useMemo(() => {
    const dates: Date[] = []
    
    // Add booked periods
    bookings.forEach((booking) => {
      const start = new Date(booking.start_date)
      const end = new Date(booking.end_date)
      const days = eachDayOfInterval({ start, end })
      dates.push(...days)
    })
    
    // Add exceptions
    exceptions.forEach((exc) => {
      dates.push(new Date(exc.unavailable_date))
    })
    
    return dates
  }, [bookings, exceptions])

  const isDateUnavailable = (date: Date) => {
    const today = startOfDay(new Date())
    if (isBefore(date, today)) return true
    return unavailableDates.some((d) => isSameDay(d, date))
  }

  const handleDateClick = (date: Date) => {
    if (isDateUnavailable(date)) return

    if (!startDate || (startDate && endDate) || (!isSelectingEnd && startDate)) {
      setStartDate(date)
      setEndDate(null)
      setIsSelectingEnd(true)
    } else if (isSelectingEnd) {
      if (isBefore(date, startDate)) {
        setStartDate(date)
        setEndDate(null)
      } else {
        // Check if any date in range is unavailable
        const days = eachDayOfInterval({ start: startDate, end: date })
        const hasUnavailable = days.some((d) => isDateUnavailable(d))
        if (!hasUnavailable) {
          setEndDate(date)
          setIsSelectingEnd(false)
        }
      }
    }
  }

  const isInRange = (date: Date) => {
    if (!startDate) return false
    if (!endDate && isSelectingEnd && startDate) {
      return isSameDay(date, startDate)
    }
    if (startDate && endDate) {
      return (isAfter(date, startDate) || isSameDay(date, startDate)) &&
             (isBefore(date, endDate) || isSameDay(date, endDate))
    }
    return false
  }

  // Calculate price
  const totalDays = startDate && endDate ? calculateDays(startDate, endDate) : 0
  const subtotal = startDate && endDate
    ? calculateRentalPrice(listing.price_per_day_cents, listing.price_per_week_cents, totalDays)
    : 0
  const serviceFee = calculateServiceFee(subtotal)
  const deposit = listing.deposit_cents
  const totalToPayNow = subtotal + serviceFee
  const totalAuthorization = totalToPayNow + deposit

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    
    const days: (Date | null)[] = []
    
    // Add padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const calendarDays = generateCalendarDays()

  const handleBooking = () => {
    if (!startDate || !endDate) return
    
    const params = new URLSearchParams({
      listing: listing.id,
      start: format(startDate, "yyyy-MM-dd"),
      end: format(endDate, "yyyy-MM-dd"),
    })
    
    router.push(`/bookings/new?${params.toString()}`)
  }

  if (isOwner) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">Gestione annuncio</h3>
        <p className="text-sm text-muted-foreground">
          {t("booking.card.owner_notice")}
        </p>
        <div className="mt-4 space-y-2">
          <Link
            href={`/listings/${listing.id}/edit`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Settings className="h-4 w-4" />
            {t("booking.card.edit_listing")}
          </Link>
          <Link
            href="/dashboard/listings"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted"
          >
            <Package className="h-4 w-4" />
            Vai ai tuoi annunci
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Price */}
      <div className="mb-6 text-center">
        <span className="text-3xl font-bold text-primary">
          {formatPrice(listing.price_per_day_cents, listing.currency_code)}
        </span>
        <span className="text-muted-foreground"> {t("listings.per_day")}</span>
      </div>

      {/* Calendar */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
            className="rounded-lg p-1 hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <span className="font-medium text-foreground">
            {format(currentMonth, "MMMM yyyy", { locale: it })}
          </span>
          <button
            onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
            className="rounded-lg p-1 hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
          <div>Lu</div>
          <div>Ma</div>
          <div>Me</div>
          <div>Gi</div>
          <div>Ve</div>
          <div>Sa</div>
          <div>Do</div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} />
            }

            const unavailable = isDateUnavailable(day)
            const inRange = isInRange(day)
            const isStart = startDate && isSameDay(day, startDate)
            const isEnd = endDate && isSameDay(day, endDate)

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDateClick(day)}
                disabled={unavailable}
                className={`
                  aspect-square rounded-lg text-sm font-medium transition-colors
                  ${unavailable 
                    ? "cursor-not-allowed text-muted-foreground/40 line-through" 
                    : "hover:bg-muted"
                  }
                  ${inRange && !isStart && !isEnd ? "bg-primary/20" : ""}
                  ${isStart || isEnd ? "bg-primary text-primary-foreground" : ""}
                  ${!unavailable && !inRange ? "text-foreground" : ""}
                `}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-primary" />
            <span>{t("booking.card.selected")}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-muted-foreground/30 line-through" />
            <span>{t("booking.card.unavailable")}</span>
          </div>
        </div>
      </div>

      {/* Selected dates */}
      {startDate && (
        <div className="mb-4 rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {format(startDate, "d MMM", { locale: it })}
              {endDate && ` - ${format(endDate, "d MMM", { locale: it })}`}
            </span>
            {totalDays > 0 && (
              <span className="text-muted-foreground">
                ({totalDays} {totalDays === 1 ? t("booking.card.day") : t("booking.days")})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Price breakdown */}
      {totalDays > 0 && (
        <div className="mb-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {formatPrice(listing.price_per_day_cents, listing.currency_code)} x {totalDays} {t("booking.days")}
            </span>
            <span className="text-foreground">{formatPrice(subtotal, listing.currency_code)}</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              {t("booking.service_fee")}
              <Info className="h-3 w-3" />
            </span>
            <span className="text-foreground">{formatPrice(serviceFee, listing.currency_code)}</span>
          </div>
          {deposit > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("booking.card.deposit_refundable")}</span>
              <span className="text-foreground">{formatPrice(deposit, listing.currency_code)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <span className="text-foreground">Totale noleggio da pagare</span>
            <span className="text-foreground">{formatPrice(totalToPayNow, listing.currency_code)}</span>
          </div>
          {deposit > 0 && (
            <div className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              Caparra separata: {formatPrice(deposit, listing.currency_code)}. Importo totale autorizzato sulla carta:
              <span className="ml-1 font-semibold text-foreground">
                {formatPrice(totalAuthorization, listing.currency_code)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Book button */}
      {isLoggedIn ? (
        <button
          onClick={handleBooking}
          disabled={!startDate || !endDate}
          className="w-full rounded-lg bg-accent py-3 font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startDate && endDate ? t("listing.book_now") : t("booking.select_dates")}
        </button>
      ) : (
        <Link
          href={`/auth/login?redirect=/listings/${listing.id}`}
          className="block w-full rounded-lg bg-primary py-3 text-center font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("booking.card.login_to_book")}
        </Link>
      )}
    </div>
  )
}

