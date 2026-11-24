import { describe, expect, it } from "vitest";
import { commissionMinor, formatMoney, toMinor } from "./money";

describe("money", () => {
  it("formats kobo as naira", () => {
    expect(formatMoney(1_600_000)).toContain("16,000");
    expect(formatMoney(1_600_000)).toContain("₦");
  });
  it("converts major to minor without float drift", () => {
    expect(toMinor(19.99)).toBe(1999);
  });
  it("returns null commission when not configured", () => {
    expect(commissionMinor(100_000, null)).toBeNull();
    expect(commissionMinor(100_000, 500)).toBe(5_000);
  });
});
