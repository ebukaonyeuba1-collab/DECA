import { describe, expect, it } from "vitest";
import { createPaystackProvider, paystackSignature } from "./paystack";

describe("paystack webhook signature", () => {
  const secret = "sk_test_abc";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "r1" } });
  const p = createPaystackProvider(secret);
  it("accepts a valid signature", () => expect(p.verifyWebhookSignature(body, paystackSignature(body, secret))).toBe(true));
  it("rejects a forged or missing signature", () => {
    expect(p.verifyWebhookSignature(body, "deadbeef")).toBe(false);
    expect(p.verifyWebhookSignature(body, null)).toBe(false);
    expect(p.verifyWebhookSignature(body + " ", paystackSignature(body, secret))).toBe(false);
  });
  it("flags sandbox keys", () => expect(p.isSandbox).toBe(true));
});
