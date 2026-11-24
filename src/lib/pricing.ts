import { formatMoney } from "./money";

export type PricingType = "fixed" | "starting" | "hourly" | "daily" | "per_project" | "inspection_based";

/** Honest price wording: never implies a fixed price when the professional only gave a starting point. */
export function priceLabel(type: PricingType | null | undefined, minor: number | null | undefined, currency = "NGN"): string {
  if (type === "inspection_based") return "Quotation after inspection";
  if (type === "per_project") return "Quotation per project";
  if (minor == null || !type) return "Quotation on request";
  const m = formatMoney(minor, currency);
  switch (type) {
    case "starting": return `From ${m}`;
    case "hourly": return `${m} per hour`;
    case "daily": return `${m} per day`;
    default: return m;
  }
}
