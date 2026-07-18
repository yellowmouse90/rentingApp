"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { detectCurrentLocation, type ClientLocation } from "@/lib/location/client"
import { locationToPointWkt, parseListingPrices, pointWktToLocation } from "@/lib/listings/form"
import { CategoryHierarchySelect } from "@/components/listings/category-hierarchy-select"
import { useLanguage } from "@/lib/i18n/language-context"
import type { Category } from "@/lib/types"
import { ChevronLeft, Loader2, Navigation, Trash2 } from "lucide-react"

interface EditableListing {
  id: string
  owner_id: string
  title: string
  description: string | null
  category_id: string | null
  condition: "new" | "like_new" | "good" | "fair"
  price_per_day_cents: number
  price_per_week_cents: number | null
  deposit_cents: number
  is_available: boolean
  item_location_name: string | null
  item_coords: string | null
}

export default function EditListingPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const listingId = useMemo(() => params?.id || "", [params])
  const supabase = createClient()

  const conditions = [
    { value: "new", label: t("condition.new") },
    { value: "like_new", label: t("condition.like_new") },
    { value: "good", label: t("condition.good") },
    { value: "fair", label: t("condition.fair") },
  ] as const

  const [categories, setCategories] = useState<Category[]>([])
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [condition, setCondition] = useState<EditableListing["condition"]>("good")
  const [pricePerDay, setPricePerDay] = useState("")
  const [pricePerWeek, setPricePerWeek] = useState("")
  const [deposit, setDeposit] = useState("")
  const [isAvailable, setIsAvailable] = useState(true)
  const [location, setLocation] = useState<ClientLocation | null>(null)
  const [isLocating, setIsLocating] = useState(false)

  useEffect(() => {
    async function load() {
      if (!listingId) return

      setIsPageLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace(`/auth/login?redirect=/listings/${listingId}/edit`)
        return
      }

      const [{ data: categoriesData }, { data: listing, error: listingError }] = await Promise.all([
        supabase.schema("inventory_domain").from("categories").select("*").order("name"),
        supabase
          .schema("inventory_domain")
          .from("listings")
          .select("*")
          .eq("id", listingId)
          .eq("owner_id", user.id)
          .single(),
      ])

      if (listingError || !listing) {
        setError(t("listing_edit.load_error"))
        setIsPageLoading(false)
        return
      }

      const data = listing as EditableListing
      setCategories((categoriesData as Category[]) || [])
      setTitle(data.title)
      setDescription(data.description || "")
      setCategoryId(data.category_id || "")
      setCondition(data.condition)
      setPricePerDay((data.price_per_day_cents / 100).toString())
      setPricePerWeek(data.price_per_week_cents ? (data.price_per_week_cents / 100).toString() : "")
      setDeposit(data.deposit_cents ? (data.deposit_cents / 100).toString() : "")
      setIsAvailable(data.is_available)

      setLocation(pointWktToLocation(data.item_coords, data.item_location_name))

      setIsPageLoading(false)
    }

    load()
  }, [listingId, router, supabase])

  const detectLocation = () => {
    setIsLocating(true)
    setLocationError(null)

    detectCurrentLocation()
      .then((detected) => setLocation(detected))
      .catch((error) => {
        const message = error instanceof Error ? error.message : t("listing_edit.geo_error")
        setLocationError(message)
      })
      .finally(() => setIsLocating(false))
  }

  const handleDelete = async () => {
    if (!listingId || isDeleting) return

    const confirmed = window.confirm(t("listing_edit.confirm_archive"))

    if (!confirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/listings/${listingId}`, { method: "DELETE" })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || t("listing_edit.archive_error"))
      }

      router.push("/dashboard/listings")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("listing_edit.archive_error"))
      setIsDeleting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!listingId) return

    setError(null)
    setIsSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/auth/login?redirect=/listings/${listingId}/edit`)
        return
      }

      if (!title || !condition || !pricePerDay) {
        setError(t("listing_edit.required_fields"))
        setIsSaving(false)
        return
      }

      let pricePerDayCents: number
      let pricePerWeekCents: number | null
      let depositCents: number

      try {
        const parsed = parseListingPrices({ pricePerDay, pricePerWeek, deposit })
        pricePerDayCents = parsed.pricePerDayCents
        pricePerWeekCents = parsed.pricePerWeekCents
        depositCents = parsed.depositCents
      } catch (validationError) {
        setError(
          validationError instanceof Error
            ? validationError.message
            : t("listing_edit.invalid_prices")
        )
        setIsSaving(false)
        return
      }

      const { error: updateError } = await supabase
        .schema("inventory_domain")
        .from("listings")
        .update({
          title,
          description: description || null,
          category_id: categoryId || null,
          condition,
          price_per_day_cents: pricePerDayCents,
          price_per_week_cents: pricePerWeekCents,
          deposit_cents: depositCents,
          is_available: isAvailable,
          item_coords: locationToPointWkt(location),
          item_location_name: location?.name || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId)
        .eq("owner_id", user.id)

      if (updateError) {
        throw updateError
      }

      router.push(`/listings/${listingId}`)
    } catch (err) {
      console.error("Error updating listing:", err)
      setError(t("listing_edit.update_error"))
      setIsSaving(false)
    }
  }

  if (isPageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Link
          href="/dashboard/listings"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("listing_edit.back")}
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-foreground">{t("listing_edit.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("listing_edit.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            ) : null}

            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("listing_edit.field_title")}
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={150}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={t("listing_edit.title_placeholder")}
              />
            </div>

            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("listing_edit.field_category")}
              </label>
              <CategoryHierarchySelect
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                id="category"
                placeholder={t("listing_edit.category_placeholder")}
              />
            </div>

            <div>
              <label htmlFor="condition" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("listing_edit.field_condition")}
              </label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as EditableListing["condition"])}
                required
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">{t("listing_edit.select_condition")}</option>
                {conditions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("listing_edit.field_description")}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={t("listing_edit.description_placeholder")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="pricePerDay" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("listing_edit.field_price_day")}
                </label>
                <input
                  id="pricePerDay"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerDay}
                  onChange={(e) => setPricePerDay(e.target.value)}
                  required
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label htmlFor="pricePerWeek" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("listing_edit.field_price_week")}
                </label>
                <input
                  id="pricePerWeek"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerWeek}
                  onChange={(e) => setPricePerWeek(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label htmlFor="deposit" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("listing_edit.field_deposit")}
                </label>
                <input
                  id="deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("listing_edit.availability_title")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("listing_edit.availability_desc")}
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={isLocating}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                  {t("listing_edit.update_location")}
                </button>

                {location ? (
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                  >
                    {t("listing_edit.remove_location")}
                  </button>
                ) : null}
              </div>

              {location ? (
                <p className="text-sm text-foreground">
                  {t("listing_edit.location_label")} <span className="font-medium">{location.name}</span>
                </p>
              ) : null}
              {locationError ? <p className="text-sm text-destructive">{locationError}</p> : null}
            </div>

            <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t("listing_edit.archive")}
              </button>

              <div className="flex items-center gap-2">
                <Link
                  href={`/listings/${listingId}`}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("listing_edit.cancel")}
                </Link>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("listing_edit.save")}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
