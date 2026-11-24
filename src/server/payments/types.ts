export type InitializeInput = { reference: string; amountMinor: number; currency: string; email: string; callbackUrl: string; metadata?: Record<string, string> };
export type InitializeResult = { authorizationUrl: string; reference: string };
export type VerifyResult = { reference: string; status: "success" | "failed" | "abandoned" | "pending"; amountMinor: number; currency: string; paidAt: string | null };

/** Every provider implements this. Business logic never imports a provider directly. */
export interface PaymentProvider {
  readonly id: string;
  readonly isSandbox: boolean;
  initialize(input: InitializeInput): Promise<InitializeResult>;
  /** Server-side verification. The browser's "payment succeeded" is never trusted. */
  verify(reference: string): Promise<VerifyResult>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
}
export type ProviderLookup = { available: true; provider: PaymentProvider } | { available: false; reason: string };
