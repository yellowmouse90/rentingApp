"use client"

import { useRouter, useSearchParams } from "next/navigation"
import type { Category } from "@/lib/types"
import { Filter, X } from "lucide-react"
import { useState } from "react"

interface ListingsFiltersProps {
  categories: Category[]
  currentCategory?: string
  currentCondition?: string
  currentSort?: string
  currentMinPrice?: string
  currentMaxPrice?: string
  searchQuery?: string
}

const conditions = [
  { value: "new", label: "Nuovo" },
  { value: "like_new", label: "Come nuovo" },
  { value: "good", label: "Buono" },
  { value: "fair", label: "Discreto" },
]

const sortOptions = [
  { value: "newest", label: "Piu recenti" },
  { value: "oldest", label: "Meno recenti" },
  { value: "price_asc", label: "Prezzo crescente" },
  { value: "price_desc", label: "Prezzo decrescente" },
]

export function ListingsFilters({
  categories,
  currentCategory,
  currentCondition,
  currentSort,
  currentMinPrice,
  currentMaxPrice,
  searchQuery,
}: ListingsFiltersProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams()
    
    if (searchQuery) params.set("q", searchQuery)
    if (currentCategory && key !== "category") params.set("category", currentCategory)
    if (currentCondition && key !== "condition") params.set("condition", currentCondition)
    if (currentSort && key !== "sort") params.set("sort", currentSort)
    if (currentMinPrice && key !== "minPrice") params.set("minPrice", currentMinPrice)
    if (currentMaxPrice && key !== "maxPrice") params.set("maxPrice", currentMaxPrice)
    
    if (value) {
      params.set(key, value)
    }
    
    router.push(`/listings?${params.toString()}`)
  }

  const clearFilters = () => {
    const params = new URLSearchParams()
    if (searchQuery) params.set("q", searchQuery)
    router.push(`/listings${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const hasActiveFilters = currentCategory || currentCondition || currentSort || currentMinPrice || currentMaxPrice

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Categoria</h3>
        <div className="space-y-2">
          <button
            onClick={() => updateFilter("category", null)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              !currentCategory
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Tutte le categorie
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => updateFilter("category", category.slug)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                currentCategory === category.slug
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Condition */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Condizione</h3>
        <div className="space-y-2">
          <button
            onClick={() => updateFilter("condition", null)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              !currentCondition
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Qualsiasi
          </button>
          {conditions.map((condition) => (
            <button
              key={condition.value}
              onClick={() => updateFilter("condition", condition.value)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                currentCondition === condition.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {condition.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Ordina per</h3>
        <select
          value={currentSort || "newest"}
          onChange={(e) => updateFilter("sort", e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Rimuovi filtri
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile Filter Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground lg:hidden"
      >
        <Filter className="h-4 w-4" />
        Filtri
        {hasActiveFilters && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            !
          </span>
        )}
      </button>

      {/* Mobile Filter Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Filtri</h2>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FilterContent />
          </div>
        </div>
      )}

      {/* Desktop Filters */}
      <div className="hidden rounded-xl border border-border bg-card p-6 lg:block">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Filtri</h2>
        <FilterContent />
      </div>
    </>
  )
}
