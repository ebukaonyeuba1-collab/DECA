/** Parses a naira amount typed by a person ("8,500", "8500.50") into kobo. Returns null if not a valid positive amount. */
export function nairaToKobo(input: string | undefined | null): number | null {
  if (input == null) return null;
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(cleaned)) return null;
  const kobo = Math.round(Number(cleaned) * 100);
  return kobo > 0 && kobo <= 10_000_000_000 ? kobo : null;
}
