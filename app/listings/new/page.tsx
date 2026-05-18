"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Category } from "@/lib/types"
import { 
  ChevronLeft, 
  Upload, 
  X, 
  Loader2,
  ImageIcon
} from "lucide-react"

const conditions = [
  { value: "new", label: "Nuovo", description: "Mai usato, ancora imballato" },
  { value: "like_new", label: "Come nuovo", description: "Usato pochissimo, perfette condizioni" },
  { value: "good", label: "Buono", description: "Usato con cura, funziona perfettamente" },
  { value: "fair", label: "Discreto", description: "Segni di usura ma funzionante" },
]

export default function NewListingPage() {
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

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
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
      setError("Puoi caricare massimo 5 immagini")
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login?redirect=/listings/new")
        return
      }

      // Validate
      if (!title || !condition || !pricePerDay) {
        setError("Compila tutti i campi obbligatori")
        setIsLoading(false)
        return
      }

      const pricePerDayCents = Math.round(parseFloat(pricePerDay) * 100)
      const pricePerWeekCents = pricePerWeek ? Math.round(parseFloat(pricePerWeek) * 100) : null
      const depositCents = deposit ? Math.round(parseFloat(deposit) * 100) : 0

      if (pricePerDayCents <= 0) {
        setError("Il prezzo deve essere maggiore di zero")
        setIsLoading(false)
        return
      }

      // Create listing
      const { data: listing, error: listingError } = await supabase
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

          await supabase.from("listing_images").insert({
            listing_id: listing.id,
            image_url: publicUrl,
            display_order: i,
          })
        }
      }

      router.push(`/listings/${listing.id}`)
    } catch (err) {
      console.error("Error creating listing:", err)
      setError("Errore durante la creazione dell'annuncio. Riprova.")
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
          Torna agli annunci
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-foreground">Pubblica un annuncio</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Compila i dettagli del tuo attrezzo per metterlo a noleggio
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
                Titolo *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={150}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="es. Trapano Bosch Professional GSB 18V"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
                Categoria
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Seleziona una categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">
                Descrizione
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Descrivi il tuo attrezzo, le sue caratteristiche e condizioni..."
              />
            </div>

            {/* Condition */}
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                Condizione *
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
                    <div className="font-medium text-foreground">{cond.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{cond.description}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="pricePerDay" className="mb-1.5 block text-sm font-medium text-foreground">
                  Prezzo/giorno *
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
                  Prezzo/settimana
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
                  Cauzione
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
                Immagini (max 5)
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
                    <span className="mt-1 text-xs text-muted-foreground">Carica</span>
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
                Formati supportati: JPG, PNG, WebP. Max 5MB per immagine.
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-3 border-t border-border pt-6">
              <Link
                href="/listings"
                className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Annulla
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Pubblicazione...
                  </>
                ) : (
                  "Pubblica annuncio"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
