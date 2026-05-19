"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { detectCurrentLocation, type ClientLocation } from "@/lib/location/client"
import { locationToPointWkt, parseListingPrices } from "@/lib/listings/form"
import { CategoryHierarchySelect } from "@/components/listings/category-hierarchy-select"
import { useLanguage } from "@/lib/i18n/language-context"
import type { Category } from "@/lib/types"
import { 
  ChevronLeft, 
  Upload, 
  X, 
  Loader2,
  ImageIcon,
  MapPin,
  Navigation
} from "lucide-react"

const conditions = [
  { value: "new", labelKey: "condition.new", descriptionKey: "listing.new.condition.new.desc" },
  { value: "like_new", labelKey: "condition.like_new", descriptionKey: "listing.new.condition.like_new.desc" },
  { value: "good", labelKey: "condition.good", descriptionKey: "listing.new.condition.good.desc" },
  { value: "fair", labelKey: "condition.fair", descriptionKey: "listing.new.condition.fair.desc" },
]

export default function NewListingPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()
  
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [condition, setCondition] = useState("")
  const [pricePerDay, setPricePerDay] = useState("")
  const [pricePerWeek, setPricePerWeek] = useState("")
  const [deposit, setDeposit] = useState("")
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [location, setLocation] = useState<ClientLocation | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
        .schema('inventory_domain')
        .from("categories")
        .select("*")
        .order("name")
      setCategories(data || [])
    }
    loadCategories()
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + images.length > 5) {
      setError(t("listing.new.errors.max_images"))
      return
    }
    
    setImages((prev) => [...prev, ...files])
    
    // Create previews
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const detectLocation = async () => {
    setIsLocating(true)
    setLocationError(null)

    try {
      const detected = await detectCurrentLocation()
      setLocation(detected)
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      const map: Record<string, string> = {
        "La geolocalizzazione non e supportata dal tuo browser": "location.geo_unsupported",
        "Accesso alla posizione negato": "location.geo_denied_short",
        "Posizione non disponibile": "location.geo_unavailable",
        "Timeout nella richiesta della posizione": "location.geo_timeout",
      }
      setLocationError(t(map[message] || "location.geo_unknown"))
    } finally {
      setIsLocating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        router.push("/auth/login?redirect=/listings/new")
        return
      }

      // Validate
      if (!title || !condition || !pricePerDay) {
        setError(t("listing.new.errors.required"))
        setIsLoading(false)
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
        const message = validationError instanceof Error ? validationError.message : ""
        const map: Record<string, string> = {
          "Il prezzo giornaliero deve essere maggiore di zero": "listing.new.errors.invalid_daily_price",
          "Prezzo settimanale non valido": "listing.new.errors.invalid_weekly_price",
          "Cauzione non valida": "listing.new.errors.invalid_deposit",
        }
        setError(
          t(map[message] || "listing.new.errors.invalid_prices")
        )
        setIsLoading(false)
        return
      }

      if (pricePerDayCents <= 0) {
        setError(t("listing.new.errors.invalid_daily_price"))
        setIsLoading(false)
        return
      }

      // Create listing
      const { data: listing, error: listingError } = await supabase
        .schema('inventory_domain')
        .from("listings")
        .insert({
          owner_id: user.id,
          title,
          description: description || null,
          category_id: categoryId || null,
          condition,
          price_per_day_cents: pricePerDayCents,
          price_per_week_cents: pricePerWeekCents,
          deposit_cents: depositCents,
          currency_code: "EUR",
          item_coords: locationToPointWkt(location),
          item_location_name: location?.name || null,
        })
        .select()
        .single()

      if (listingError) throw listingError

      // Upload images
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const file = images[i]
          const fileExt = file.name.split(".").pop()
          const fileName = `${listing.id}/${Date.now()}-${i}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from("listing-images")
            .upload(fileName, file)

          if (uploadError) {
            console.error("Upload error:", uploadError)
            continue
          }

          const { data: { publicUrl } } = supabase.storage
            .from("listing-images")
            .getPublicUrl(fileName)

          await supabase
            .schema('inventory_domain')
            .from("listing_images")
            .insert({
            listing_id: listing.id,
            image_url: publicUrl,
            display_order: i,
          })
        }
      }

      router.push(`/listings/${listing.id}`)
    } catch (err) {
      console.error("Error creating listing:", err)
      setError(t("listing.new.errors.create_failed"))
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Link
          href="/listings"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("listing.new.back")}
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-foreground">{t("listing.new.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("listing.new.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("listing.new.fields.title")} *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={150}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={t("listing.new.fields.title_placeholder")}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("listings.filters.category")}
              </label>
              <CategoryHierarchySelect
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                id="category"
                placeholder={t("listing.new.fields.category_placeholder")}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("listing.new.fields.description")}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={t("listing.new.fields.description_placeholder")}
              />
            </div>

            {/* Condition */}
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                {t("listings.filters.condition")} *
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {conditions.map((cond) => (
                  <label
                    key={cond.value}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      condition === cond.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      value={cond.value}
                      checked={condition === cond.value}
                      onChange={(e) => setCondition(e.target.value)}
                      className="sr-only"
                    />
                    <div className="font-medium text-foreground">{t(cond.labelKey)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{t(cond.descriptionKey)}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="pricePerDay" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("listing.new.fields.price_day")} *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <input
                    id="pricePerDay"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={pricePerDay}
                    onChange={(e) => setPricePerDay(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background py-2.5 pl-8 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="15.00"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="pricePerWeek" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("listing.new.fields.price_week")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <input
                    id="pricePerWeek"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerWeek}
                    onChange={(e) => setPricePerWeek(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background py-2.5 pl-8 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="80.00"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="deposit" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("listing.new.fields.deposit")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <input
                    id="deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background py-2.5 pl-8 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="50.00"
                  />
                </div>
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                {t("listing.new.images.title")}
              </label>
              
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                    <img src={preview} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                
                {images.length < 5 && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-muted/50">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="mt-1 text-xs text-muted-foreground">{t("listing.new.images.upload")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("listing.new.images.hint")}
              </p>
            </div>

            {/* Location */}
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                {t("listing.new.location.title")}
              </label>
              
              {location ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span className="flex-1 font-medium text-foreground">
                      {location.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLocation(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={isLocating}
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {isLocating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                    {t("listing.new.location.update")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={isLocating}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                  >
                    {isLocating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Navigation className="h-5 w-5" />
                    )}
                    {t("listing.new.location.use_current")}
                  </button>
                  {locationError && (
                    <p className="text-xs text-destructive">{locationError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("listing.new.location.help")}
                  </p>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 border-t border-border pt-6">
              <Link
                href="/listings"
                className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {t("common.cancel")}
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("listing.new.submit.loading")}
                  </>
                ) : (
                  t("listing.new.submit.idle")
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
