"use client"

import { Star } from "lucide-react"

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: "sm" | "md" | "lg"
}

const SIZE_CLASSES: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
}

// readOnly is implicit: pass onChange to make it interactive, omit it for
// a pure display (review cards, summaries).
export function StarRating({ value, onChange, size = "md" }: StarRatingProps) {
  const sizeClass = SIZE_CLASSES[size]
  const readOnly = !onChange

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          aria-label={`${star} stelle`}
          className={readOnly ? "cursor-default" : "cursor-pointer"}
        >
          <Star
            className={`${sizeClass} ${
              star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  )
}
