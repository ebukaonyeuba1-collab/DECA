import { createHmac, timingSafeEqual } from "node:crypto";
import type { InitializeInput, PaymentProvider, VerifyResult } from "./types";

const BASE = "https://api.paystack.co";

export function paystackSignature(rawBody: string, secret: string): string {
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

export function createPaystackProvider(secret: string): PaymentProvider {
  const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
  return {
    id: "paystack",
    isSandbox: secret.startsWith("sk_test_"),
    async initialize(i: InitializeInput) {
      const res = await fetch(`${BASE}/transaction/initialize`, {
        method: "POST", headers,
        body: JSON.stringify({ email: i.email, amount: i.amountMinor, currency: i.currency, reference: i.reference, callback_url: i.callbackUrl, metadata: i.metadata }),
      });
      const json = await res.json();
      if (!res.ok || !json.status) throw new Error(`Paystack initialize failed: ${json.message ?? res.status}`);
      return { authorizationUrl: json.data.authorization_url as string, reference: json.data.reference as string };
    },
    async verify(reference: string): Promise<VerifyResult> {
      const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.status) throw new Error(`Paystack verify failed: ${json.message ?? res.status}`);
      const d = json.data;
      return { reference, status: d.status, amountMinor: d.amount, currency: d.currency, paidAt: d.paid_at ?? null };
    },
    verifyWebhookSignature(rawBody, signature) {
      if (!signature) return false;
      const expected = Buffer.from(paystackSignature(rawBody, secret));
      const given = Buffer.from(signature);
      return expected.length === given.length && timingSafeEqual(expected, given);
    },
  };
}
