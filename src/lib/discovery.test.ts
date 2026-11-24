import { describe, expect, it } from "vitest";
import { addRecent, parseLocationCookie, parseRecentCookie } from "./cookie-state";
import { parseDiscoveryParams, toQueryString, toRpcArgs } from "./discovery-params";
import { priceLabel } from "./pricing";
import { initials, publicMediaUrl } from "./media";

const uuid = "00000000-0000-4000-8000-000000000001";

describe("discovery params", () => {
  it("parses valid input", () => {
    const p = parseDiscoveryParams({ q: " plumber ", category: "plumbing", l: uuid, rating: "4", years: "5", verified: "identity", maxPrice: "20000", avail: "1", sort: "rating", page: "2" });
    expect(p).toMatchObject({ q: "plumber", category: "plumbing", loc: uuid, rating: 4, years: 5, verified: "identity", maxPrice: 20000, avail: true, sort: "rating", page: 2 });
  });
  it("drops hostile or invalid input instead of throwing", () => {
    const p = parseDiscoveryParams({ category: "x; drop table", l: "not-a-uuid", rating: "9", years: "-1", verified: "all", maxPrice: "1e99", sort: "random", page: "0", q: "a".repeat(500) });
    expect(p).toMatchObject({ category: undefined, loc: undefined, rating: undefined, years: undefined, verified: undefined, maxPrice: undefined, sort: "recommended", page: 1 });
    expect(p.q?.length).toBe(80);
  });
  it("uses the first value of repeated params", () => expect(parseDiscoveryParams({ category: ["plumbing", "cleaning"] }).category).toBe("plumbing"));
  it("round-trips through a query string and builds RPC args (naira to kobo, paging)", () => {
    const p = parseDiscoveryParams({ q: "ac", maxPrice: "15000", page: "3" });
    expect(toQueryString(p)).toBe("?q=ac&maxPrice=15000&page=3");
    expect(toQueryString(p, { page: undefined })).toBe("?q=ac&maxPrice=15000");
    expect(toRpcArgs(p)).toMatchObject({ p_query: "ac", p_max_price_minor: 1_500_000, p_limit: 12, p_offset: 24, p_sort: "recommended" });
  });
});
describe("cookies", () => {
  it("accepts a valid location and rejects tampering", () => {
    expect(parseLocationCookie(encodeURIComponent(JSON.stringify({ id: uuid, label: "Warri, Delta" })))).toEqual({ id: uuid, label: "Warri, Delta" });
    for (const bad of [undefined, "", "{", encodeURIComponent('{"id":"x","label":"y"}'), encodeURIComponent(JSON.stringify({ id: uuid, label: "" }))]) expect(parseLocationCookie(bad)).toBeNull();
  });
  it("keeps only valid recent slugs, newest first, max six", () => {
    expect(parseRecentCookie("a-b,<script>,c")).toEqual(["a-b", "c"]);
    expect(addRecent(["a", "b", "c", "d", "e", "f"], "z")).toEqual(["z", "a", "b", "c", "d", "e"]);
    expect(addRecent(["a", "b"], "b")).toEqual(["b", "a"]);
  });
});
describe("pricing and media helpers", () => {
  it("never presents a starting price as fixed", () => {
    expect(priceLabel("starting", 800_000)).toBe("From ₦8,000");
    expect(priceLabel("hourly", 500_000)).toBe("₦5,000 per hour");
    expect(priceLabel("inspection_based", null)).toBe("Quotation after inspection");
    expect(priceLabel("fixed", null)).toBe("Quotation on request");
  });
  it("builds public media URLs only for the public bucket and strips demo tags from initials", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    expect(publicMediaUrl("u1/a b.jpg")).toBe("https://x.supabase.co/storage/v1/object/public/public-media/u1/a%20b.jpg");
    expect(publicMediaUrl(null)).toBeNull();
    expect(initials("[DEMO] Ade Plumbing")).toBe("AP");
  });
});
