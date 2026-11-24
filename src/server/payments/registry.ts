import "server-only";
import { createPaystackProvider } from "./paystack";
import type { ProviderLookup } from "./types";

/** Returns an explicit unavailable state instead of pretending a live integration exists. */
export function getPaymentProvider(): ProviderLookup {
  const provider = process.env.PAYMENTS_PROVIDER ?? "paystack";
  if (provider === "paystack") {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key || key.endsWith("xxx")) return { available: false, reason: "PAYSTACK_SECRET_KEY is not configured" };
    return { available: true, provider: createPaystackProvider(key) };
  }
  return { available: false, reason: `Unknown payment provider: ${provider}` };
}

/** Protected payments (custody/escrow-like behaviour) stay off until a partner and legal structure are confirmed. */
export function protectedPaymentsEnabled(): boolean {
  return process.env.PROTECTED_PAYMENTS_ENABLED === "true";
}
