// All money is stored as integer minor units (kobo). Never use floats for amounts.
export function formatMoney(minor: number | bigint, currency = "NGN"): string {
  const major = Number(minor) / 100;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: major % 1 === 0 ? 0 : 2 }).format(major);
}
export function toMinor(major: number): number {
  return Math.round(major * 100);
}
/** Commission in basis points (1 bp = 0.01%). Returns null when no rate is configured, so callers record nothing. */
export function commissionMinor(amountMinor: number, rateBps: number | null | undefined): number | null {
  if (rateBps == null) return null;
  return Math.round((amountMinor * rateBps) / 10_000);
}
