import { describe, expect, it } from "vitest";
import { registerSchema, resetSchema } from "@/server/auth/schemas";
import { businessSchema, coverageSchema, customerProfileSchema, dayOffSchema, parseAvailability, portfolioItemSchema, professionalProfileSchema, serviceSchema } from "./schemas";

const u = "00000000-0000-4000-8000-000000000001";
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

describe("registration", () => {
  const ok = { fullName: "Ade Bello", email: "ADE@Example.com", phone: "+2348012345678", password: "a-long-password", role: "professional", locationId: u, privacyConsent: "on" };
  it("accepts valid input and normalises email", () => { const r = registerSchema.safeParse(ok); expect(r.success && r.data.email).toBe("ade@example.com"); });
  it("never accepts an admin role", () => { expect(registerSchema.safeParse({ ...ok, role: "admin" }).success).toBe(false); expect(registerSchema.safeParse({ ...ok, role: "super_admin" }).success).toBe(false); });
  it("requires consent, a long password and a valid phone", () => {
    expect(registerSchema.safeParse({ ...ok, privacyConsent: undefined }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, phone: "abc" }).success).toBe(false);
  });
  it("treats an empty location as absent", () => { const r = registerSchema.safeParse({ ...ok, locationId: "" }); expect(r.success && r.data.locationId).toBeUndefined(); });
  it("password reset needs matching long passwords", () => {
    expect(resetSchema.safeParse({ password: "long-enough-1", confirm: "long-enough-1" }).success).toBe(true);
    expect(resetSchema.safeParse({ password: "long-enough-1", confirm: "different" }).success).toBe(false);
  });
});
describe("professional onboarding", () => {
  it("profile requires category and experience", () => {
    const base = { accountType: "individual", fullName: "Ade Bello", phone: "08012345678", displayName: "Ade Plumbing", yearsExperience: "5", primaryCategoryId: u };
    expect(professionalProfileSchema.safeParse(base).success).toBe(true);
    expect(professionalProfileSchema.safeParse({ ...base, primaryCategoryId: "nope" }).success).toBe(false);
    expect(professionalProfileSchema.safeParse({ ...base, yearsExperience: "-1" }).success).toBe(false);
    expect(professionalProfileSchema.safeParse({ ...base, accountType: "admin" }).success).toBe(false);
  });
  it("business: optional fields may be empty, bad ones are rejected", () => {
    expect(businessSchema.safeParse({ registeredName: "Ade Ltd", email: "", website: "", yearEstablished: "" }).success).toBe(true);
    expect(businessSchema.safeParse({ registeredName: "Ade Ltd", website: "javascript:alert(1)" }).success).toBe(false);
    expect(businessSchema.safeParse({ registeredName: "Ade Ltd", yearEstablished: "1800" }).success).toBe(false);
  });
  it("service: priced types require a valid naira amount; quotation types do not", () => {
    const base = { name: "Leak repair", categoryId: u, pricingType: "starting", price: "8,500" };
    expect(serviceSchema.safeParse(base).success).toBe(true);
    expect(serviceSchema.safeParse({ ...base, price: "" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, price: "free" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, pricingType: "inspection_based", price: "" }).success).toBe(true);
    expect(serviceSchema.safeParse({ ...base, pricingType: "hacked" }).success).toBe(false);
  });
  it("coverage, days off and portfolio validate dates and ids", () => {
    expect(coverageSchema.safeParse({ locationId: u, travel: "on" }).success).toBe(true);
    expect(coverageSchema.safeParse({ locationId: "x" }).success).toBe(false);
    expect(dayOffSchema.safeParse({ startsOn: "2026-12-01", endsOn: "2026-12-05" }).success).toBe(true);
    expect(dayOffSchema.safeParse({ startsOn: "2026-12-05", endsOn: "2026-12-01" }).success).toBe(false);
    expect(dayOffSchema.safeParse({ startsOn: "not-a-date", endsOn: "2026-12-01" }).success).toBe(false);
    expect(portfolioItemSchema.safeParse({ title: "Kitchen sink", completedOn: "2999-01-01" }).success).toBe(false);
    expect(portfolioItemSchema.safeParse({ title: "Kitchen sink", completedOn: "" }).success).toBe(true);
  });
  it("availability: validates times and ordering", () => {
    expect(parseAvailability(fd({ d1_on: "on", d1_start: "08:00", d1_end: "17:00" }))).toEqual({ slots: [{ weekday: 1, start: "08:00", end: "17:00" }] });
    expect(parseAvailability(fd({}))).toEqual({ slots: [] });
    expect("error" in parseAvailability(fd({ d2_on: "on", d2_start: "17:00", d2_end: "08:00" }))).toBe(true);
    expect("error" in parseAvailability(fd({ d2_on: "on", d2_start: "25:00", d2_end: "26:00" }))).toBe(true);
  });
  it("customer profile validates phone", () => {
    expect(customerProfileSchema.safeParse({ fullName: "Ngozi A", phone: "+2348012345678" }).success).toBe(true);
    expect(customerProfileSchema.safeParse({ fullName: "Ngozi A", phone: "12" }).success).toBe(false);
  });
});
