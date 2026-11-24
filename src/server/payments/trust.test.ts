import { describe, expect, it } from "vitest";
import { isPaymentConfirmed } from "./trust";

const exp = { amountMinor: 1_600_000, currency: "NGN", reference: "r1" };
const ok = { reference: "r1", status: "success" as const, amountMinor: 1_600_000, currency: "NGN", paidAt: "2026-01-01T00:00:00Z" };

describe("payment confirmation", () => {
  it("accepts only an exact server-verified match", () => expect(isPaymentConfirmed(ok, exp)).toBe(true));
  it("rejects wrong amount, currency, reference or non-success status", () => {
    expect(isPaymentConfirmed({ ...ok, amountMinor: 1 }, exp)).toBe(false);
    expect(isPaymentConfirmed({ ...ok, currency: "USD" }, exp)).toBe(false);
    expect(isPaymentConfirmed({ ...ok, reference: "other" }, exp)).toBe(false);
    for (const status of ["failed", "abandoned", "pending"] as const) expect(isPaymentConfirmed({ ...ok, status }, exp)).toBe(false);
  });
});
