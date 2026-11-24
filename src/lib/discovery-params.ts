import { z } from "zod";

export const SORTS = ["recommended", "rating", "experience", "newest", "reviews"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABEL: Record<Sort, string> = { recommended: "Recommended", rating: "Highest rated", experience: "Most experienced", newest: "Recently joined", reviews: "Most reviewed" };
export const PAGE_SIZE = 12;

export type DiscoveryParams = {
  q?: string; category?: string; sub?: string; loc?: string; rating?: number;
  verified?: "identity" | "credentials" | "experience"; years?: number; maxPrice?: number; avail?: boolean; sort: Sort; page: number;
};
type Raw = Record<string, string | string[] | undefined>;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pick = <T>(schema: z.ZodType<T>, v: string | undefined): T | undefined => { const r = schema.safeParse(v); return r.success ? r.data : undefined; };

/** Untrusted URL input in, safe typed parameters out. Anything invalid is dropped, never thrown. */
export function parseDiscoveryParams(raw: Raw): DiscoveryParams {
  const g = (k: string) => first(raw[k]);
  const q = g("q")?.trim().slice(0, 80);
  const num = (k: string, allowed: number[]) => { const n = Number(g(k)); return allowed.includes(n) ? n : undefined; };
  const price = Number(g("maxPrice"));
  const page = Number(g("page"));
  return {
    q: q || undefined,
    category: pick(slug, g("category")), sub: pick(slug, g("sub")),
    loc: pick(z.string().uuid(), g("l")),
    rating: num("rating", [3, 4, 4.5]), years: num("years", [2, 5, 10]),
    verified: pick(z.enum(["identity", "credentials", "experience"]), g("verified")),
    maxPrice: Number.isInteger(price) && price > 0 && price <= 10_000_000 ? price : undefined,
    avail: g("avail") === "1" ? true : undefined,
    sort: pick(z.enum(SORTS), g("sort")) ?? "recommended",
    page: Number.isInteger(page) && page >= 1 && page <= 200 ? page : 1,
  };
}

export function toQueryString(p: Partial<DiscoveryParams>, overrides: Partial<Record<keyof DiscoveryParams | "l", string | number | boolean | undefined>> = {}): string {
  const out = new URLSearchParams();
  const base: Record<string, unknown> = { q: p.q, category: p.category, sub: p.sub, l: p.loc, rating: p.rating, years: p.years, verified: p.verified, maxPrice: p.maxPrice, avail: p.avail ? "1" : undefined, sort: p.sort && p.sort !== "recommended" ? p.sort : undefined, page: p.page && p.page > 1 ? p.page : undefined };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v !== undefined && v !== "" && v !== false) out.set(k, String(v));
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** Maps validated params to the search_professionals RPC. Price is entered in naira, stored in kobo. */
export function toRpcArgs(p: DiscoveryParams) {
  return {
    p_query: p.q ?? null, p_category: p.category ?? null, p_subcategory: p.sub ?? null, p_location: p.loc ?? null,
    p_min_rating: p.rating ?? null, p_verification: p.verified ?? "any", p_min_years: p.years ?? null,
    p_max_price_minor: p.maxPrice ? p.maxPrice * 100 : null, p_available_today: p.avail ?? false,
    p_sort: p.sort, p_limit: PAGE_SIZE, p_offset: (p.page - 1) * PAGE_SIZE,
  };
}
