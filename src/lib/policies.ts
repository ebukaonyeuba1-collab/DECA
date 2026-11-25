export type PolicyKey = "professional_terms" | "marketplace_rules" | "verification_policy" | "transaction_policy" | "privacy_policy" | "dispute_policy";
export const POLICY_TITLES: Record<PolicyKey, string> = {
  professional_terms: "Professional terms", marketplace_rules: "Marketplace rules", verification_policy: "Verification policy",
  transaction_policy: "Transaction policy", privacy_policy: "Privacy policy", dispute_policy: "Dispute policy",
};
export const PROFESSIONAL_POLICIES = Object.keys(POLICY_TITLES) as PolicyKey[];
export const isPolicyKey = (k: string): k is PolicyKey => k in POLICY_TITLES;

/** DRAFT summaries of product decisions. Replace with counsel-approved texts before onboarding real users. */
export const POLICY_DRAFT: Record<PolicyKey, string[]> = {
  professional_terms: ["You provide accurate information about your identity, experience and services.", "You are responsible for the quality, safety and legality of the work you carry out.", "Your listing is visible to the public only after DECA approves it, and may be suspended."],
  marketplace_rules: ["Communicate with customers through DECA.", "Do not publish false reviews, qualifications or work samples.", "Paid placements are always labelled and never replace verification."],
  verification_policy: ["DECA reviewers decide verification. Badges are never automatic and never depend on a subscription.", "Submitted evidence cannot be changed or deleted once you submit; you can add new documents when DECA asks for more information.", "Documents are stored privately and seen only by you and authorised DECA reviewers."],
  transaction_policy: ["Quotations must be approved by the customer before work is booked.", "Payments and any protection arrangements will be offered only through licensed providers once available. DECA does not currently hold funds.", "Commission, if any, applies only to completed jobs."],
  privacy_policy: ["DECA collects the information needed to run the marketplace and verify professionals.", "Your private contact details are not shown publicly.", "You can ask to access, correct or delete your data, subject to legal retention duties (NDPA 2023)."],
  dispute_policy: ["Complaints must relate to a booking made through DECA.", "DECA reviews evidence from both parties and records a decision.", "DECA does not guarantee a particular outcome."],
};
