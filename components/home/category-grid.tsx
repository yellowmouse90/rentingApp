import Link from "next/link"
import type { Category } from "@/lib/types"
import {
  Zap,
  TreePine,
  HardHat,
  Sparkles,
  Car,
  Hammer,
  Wrench,
  Plug,
  Paintbrush,
  Shovel,
  Package,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  TreePine,
  HardHat,
  Sparkles,
  Car,
  Hammer,
  Wrench,
  Plug,
  Paintbrush,
  Shovel,
}

interface CategoryGridProps {
  categories: Category[]
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  const { tCategory } = useLanguage()

  return (
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      {categories.map((category) => {
        const Icon = category.icon_name ? iconMap[category.icon_name] : Package
        return (
          <Link
            key={category.id}
            href={`/listings?category=${category.slug}`}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {Icon && <Icon className="h-6 w-6" />}
            </div>
            <span className="text-center text-sm font-medium text-foreground">
              {tCategory(category.id, category.name)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
