import { Star } from "lucide-react";

/** Never shows stars for a professional with no reviews. */
export function Rating({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return <span className="text-sm font-semibold text-ink-muted">New on DECA</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold" aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${count} reviews`}>
      <Star className="h-4 w-4 fill-warning text-warning" aria-hidden="true" />{avg.toFixed(1)}<span className="font-medium text-ink-muted">({count})</span>
    </span>
  );
}
