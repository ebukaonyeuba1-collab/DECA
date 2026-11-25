import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth/session";
import { nextStep } from "@/lib/onboarding-steps";
import { getOnboardingData } from "@/server/onboarding/queries";

export const dynamic = "force-dynamic";
export default async function Onboarding() {
  const user = await requireRole(["professional"]);
  redirect(`/workspace/onboarding/${nextStep((await getOnboardingData(user.id)).steps)}`);
}
