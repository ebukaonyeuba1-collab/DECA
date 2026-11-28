import { PageHeader } from "@/components/workspace/ui";
import { PortfolioStep } from "@/components/onboarding/steps";
import { requireRole } from "@/server/auth/session";
import { requireProfessional } from "@/server/workspace/queries";
import { getOnboardingData } from "@/server/onboarding/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolio" };
export default async function Page() {
  await requireProfessional(); const user = await requireRole(["professional"]);
  return <div><PageHeader title="Portfolio" /><PortfolioStep d={await getOnboardingData(user.id)} userId={user.id} manage /></div>;
}
