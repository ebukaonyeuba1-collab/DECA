import { describe, expect, it } from "vitest";
import { nextStep, readyToSubmit, stepStates, type Progress } from "./onboarding-steps";

const base: Progress = { hasProfile: false, services: 0, coverage: 0, portfolio: 0, availabilityRows: 0, requiredDocs: 1, uploadedRequiredDocs: 0, status: "not_started" };
describe("onboarding progress", () => {
  it("starts at the profile step and is not ready", () => { const s = stepStates(base); expect(nextStep(s)).toBe("profile"); expect(readyToSubmit(s)).toBe(false); });
  it("moves through blocking steps in order", () => {
    expect(nextStep(stepStates({ ...base, hasProfile: true }))).toBe("services");
    expect(nextStep(stepStates({ ...base, hasProfile: true, services: 1 }))).toBe("coverage");
    expect(nextStep(stepStates({ ...base, hasProfile: true, services: 1, coverage: 1 }))).toBe("documents");
  });
  it("optional steps never block submission", () => {
    const s = stepStates({ ...base, hasProfile: true, services: 1, coverage: 1, uploadedRequiredDocs: 1 });
    expect(readyToSubmit(s)).toBe(true); expect(nextStep(s)).toBe("review");
  });
  it("review is done only once submitted", () => {
    expect(stepStates({ ...base, status: "incomplete" }).find((x) => x.key === "review")?.done).toBe(false);
    expect(stepStates({ ...base, status: "submitted" }).find((x) => x.key === "review")?.done).toBe(true);
  });
});
