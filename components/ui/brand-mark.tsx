/**
 * The "loop" glyph: a P that closes into a return arrow, echoing the "si chiama Pietro
 * e torna indietro" wordplay. Used wherever the site shows just the mark (header, footer);
 * `app/icon.svg` and the mobile app icons carry the same shape independently since those
 * are static assets rather than React components.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="42" y="12" width="13" height="68" rx="6.5" fill="currentColor" />
      <path d="M55,12 A18,18 0 0 1 55,48" stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
      <path d="M59.5,51.8 A21,21 0 1 1 38.5,51.8" stroke="#12B569" strokeWidth="9" strokeLinecap="round" />
      <polygon points="32,46 42,50 35,59" fill="#12B569" />
    </svg>
  )
}
