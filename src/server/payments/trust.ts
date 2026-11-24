import type { VerifyResult } from "./types";

/**
 * The only acceptable basis for treating a payment as paid (Stage 7 will call this after provider.verify()).
 * Browser redirects, query strings and webhook bodies are NOT evidence.
 */
export function isPaymentConfirmed(result: VerifyResult, expected: { amountMinor: number; currency: string; reference: string }): boolean {
  return result.status === "success" && result.reference === expected.reference
    && result.amountMinor === expected.amountMinor && result.currency === expected.currency;
}
