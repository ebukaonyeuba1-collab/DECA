// Vendor-neutral boundaries. Launch uses manual review by DECA administrators; no vendor is hardcoded.
export type IdentityCheckResult = { status: "verified" | "failed" | "manual_review"; reference?: string };

export interface IdentityVerificationProvider {
  readonly id: string;
  checkIdentity(input: { fullName: string; idType: string; idNumber: string }): Promise<IdentityCheckResult>;
}
export interface OtpProvider {
  readonly id: string;
  sendCode(phone: string): Promise<void>;
  confirmCode(phone: string, code: string): Promise<boolean>;
}

/** Default: nothing is auto-verified. Documents go to the admin review queue. */
export const manualIdentityProvider: IdentityVerificationProvider = {
  id: "manual",
  async checkIdentity() { return { status: "manual_review" }; },
};
export function getIdentityProvider(): IdentityVerificationProvider {
  return manualIdentityProvider; // swap by IDENTITY_PROVIDER once a vendor is chosen
}
