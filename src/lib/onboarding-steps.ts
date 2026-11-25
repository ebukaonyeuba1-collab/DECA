export const STEPS = [
  { key: "profile", label: "Profile", blocking: true },
  { key: "services", label: "Services", blocking: true },
  { key: "coverage", label: "Areas", blocking: true },
  { key: "portfolio", label: "Portfolio", blocking: false },
  { key: "availability", label: "Hours", blocking: false },
  { key: "documents", label: "Documents", blocking: true },
  { key: "review", label: "Review", blocking: true },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];
export const isStepKey = (k: string): k is StepKey => STEPS.some((s) => s.key === k);

export type Progress = { hasProfile: boolean; services: number; coverage: number; portfolio: number; availabilityRows: number; requiredDocs: number; uploadedRequiredDocs: number; status: string };
export type StepState = { key: StepKey; label: string; blocking: boolean; done: boolean };

const SUBMITTED = ["submitted", "under_review", "approved", "rejected", "suspended"];
export function stepStates(p: Progress): StepState[] {
  const done: Record<StepKey, boolean> = {
    profile: p.hasProfile, services: p.services > 0, coverage: p.coverage > 0, portfolio: p.portfolio > 0, availability: p.availabilityRows > 0,
    documents: p.requiredDocs === 0 ? p.hasProfile : p.uploadedRequiredDocs >= p.requiredDocs, review: SUBMITTED.includes(p.status),
  };
  return STEPS.map((s) => ({ key: s.key, label: s.label, blocking: s.blocking, done: done[s.key] }));
}
/** First blocking step that is not finished, or "review" when only submission remains. */
export function nextStep(states: StepState[]): StepKey {
  return states.find((s) => s.blocking && !s.done && s.key !== "review")?.key ?? "review";
}
export function readyToSubmit(states: StepState[]): boolean {
  return states.filter((s) => s.blocking && s.key !== "review").every((s) => s.done);
}
