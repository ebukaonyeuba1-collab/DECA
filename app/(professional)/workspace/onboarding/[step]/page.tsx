import { notFound } from "next/navigation";
import { Stepper } from "@/components/onboarding/stepper";
import { AvailabilityStep, CoverageStep, DocumentsStep, PortfolioStep, ProfileStep, ReviewStep, ServicesStep } from "@/components/onboarding/steps";
import { isStepKey } from "@/lib/onboarding-steps";
import { requireRole } from "@/server/auth/session";
import { listCategories, listLocations } from "@/server/discovery/queries";
import { getOnboardingData } from "@/server/onboarding/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your profile" };

export default async function StepPage({ params, searchParams }: { params: Promise<{ step: string }>; searchParams: Promise<{ business?: string }> }) {
  const { step } = await params; const sp = await searchParams;
  if (!isStepKey(step)) notFound();
  const user = await requireRole(["professional"]);
  const d = await getOnboardingData(user.id);
  // Later steps need a profile first; send people back rather than showing forms that cannot save.
  if (!d.pro && step !== "profile") return <><Stepper steps={d.steps} current="profile" /><p className="mt-8 rounded-2xl bg-mint-50 p-4 font-semibold">Start with your profile. <a className="underline" href="/workspace/onboarding/profile">Go to profile</a></p></>;
  const [categories, states] = await Promise.all([listCategories(), listLocations(null)]);
  return (
    <div className="space-y-8">
      <Stepper steps={d.steps} current={step} />
      {step === "profile" && <ProfileStep d={d} categories={categories} states={states} userId={user.id} businessBanner={sp.business === "1"} />}
      {step === "services" && <ServicesStep d={d} categories={categories} />}
      {step === "coverage" && <CoverageStep d={d} states={states} />}
      {step === "portfolio" && <PortfolioStep d={d} userId={user.id} />}
      {step === "availability" && <AvailabilityStep d={d} />}
      {step === "documents" && <DocumentsStep d={d} />}
      {step === "review" && <ReviewStep d={d} />}
    </div>
  );
}
