import { describe, expect, it } from "vitest";
import { funnel, isActiveNav, jobActionsFor, netEarningsMinor, pct, profileCompletion, triggersReview, WORKSPACE_NAV } from "./workspace";

describe("workspace navigation", () => {
  it("covers the sections in the product spec", () => {
    const keys = WORKSPACE_NAV.map((n) => n.key);
    for (const k of ["overview", "enquiries", "quotations", "jobs", "messages", "customers", "earnings", "profile", "services", "portfolio", "availability", "analytics", "settings", "verification"]) expect(keys).toContain(k);
    expect(new Set(WORKSPACE_NAV.map((n) => n.href)).size).toBe(WORKSPACE_NAV.length);
  });
  it("highlights the right item", () => {
    expect(isActiveNav("/workspace", "/workspace")).toBe(true);
    expect(isActiveNav("/workspace/jobs", "/workspace")).toBe(false);
    expect(isActiveNav("/workspace/services/abc", "/workspace/services")).toBe(true);
    expect(isActiveNav("/workspace/servicesx", "/workspace/services")).toBe(false);
  });
});
describe("earnings and funnel use only real numbers", () => {
  it("net is gross minus recorded commission and never negative", () => {
    expect(netEarningsMinor({ gross_completed_minor: 2_000_000, commission_minor: 100_000 })).toBe(1_900_000);
    expect(netEarningsMinor({})).toBe(0); expect(netEarningsMinor({ gross_completed_minor: 1, commission_minor: 5 })).toBe(0);
  });
  it("builds the funnel from status counts", () => {
    const f = funnel({ by_status: { quotation_requested: 2, awaiting_approval: 1, confirmed: 1, completed: 3, cancelled: 2 }, quotations_sent_total: 5 });
    expect(f).toMatchObject({ enquiries: 9, quoted: 5, accepted: 4, completed: 3, cancelled: 2 });
    expect(funnel({})).toMatchObject({ enquiries: 0, accepted: 0 });
    expect(pct(3, 9)).toBe("33%"); expect(pct(0, 0)).toBe("No data yet");
  });
});
describe("job actions", () => {
  it("offers only sensible professional actions", () => {
    expect(jobActionsFor("quotation_requested").map((a) => a.to)).toEqual(["cancelled"]);
    expect(jobActionsFor("scheduled").map((a) => a.to)).toEqual(["in_progress", "cancelled"]);
    expect(jobActionsFor("in_progress").map((a) => a.to)).toEqual(["awaiting_customer_confirmation"]);
  });
  it("never lets a professional complete, refund or dispute a job", () => {
    const all = (["pending", "quotation_requested", "quotation_sent", "awaiting_approval", "confirmed", "awaiting_payment", "payment_secured", "scheduled", "in_progress", "awaiting_customer_confirmation", "completed", "cancelled", "disputed", "refunded"] as const).flatMap((s) => jobActionsFor(s).map((a) => a.to));
    for (const forbidden of ["completed", "refunded", "disputed"]) expect(all).not.toContain(forbidden);
    expect(jobActionsFor("completed")).toEqual([]);
  });
});
describe("sensitive profile changes", () => {
  const before = { accountType: "individual", categoryId: "a" };
  it("only an approved profile is sent back to review, and only for category or account type", () => {
    expect(triggersReview("approved", before, { ...before, categoryId: "b" })).toBe(true);
    expect(triggersReview("approved", before, { ...before, accountType: "business" })).toBe(true);
    expect(triggersReview("approved", before, before)).toBe(false);
    expect(triggersReview("not_started", before, { ...before, categoryId: "b" })).toBe(false);
  });
});
describe("profile completion", () => {
  const none = { displayName: false, headline: false, bio: false, experience: false, category: false, photo: false, services: false, coverage: false, portfolio: false, availability: false, documents: false };
  it("scores real progress and lists what is missing", () => {
    expect(profileCompletion(none).percent).toBe(0);
    const all = Object.fromEntries(Object.keys(none).map((k) => [k, true])) as typeof none;
    expect(profileCompletion(all)).toEqual({ percent: 100, missing: [] });
    const some = profileCompletion({ ...none, displayName: true, services: true });
    expect(some.percent).toBe(25); expect(some.missing).toContain("photo");
  });
});
