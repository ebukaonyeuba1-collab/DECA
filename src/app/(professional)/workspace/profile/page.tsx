import Link from "next/link";
import { PageHeader } from "@/components/workspace/ui";
import { ProfileStep } from "@/components/onboarding/steps";
import { WORKSPACE_NAV } from "@/lib/workspace";
import { requireRole } from "@/server/auth/session";
import { listCategories, listLocations } from "@/server/discovery/queries";
import { getOnboardingData } from "@/server/onboarding/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };
export default async function Page() {
  const user = await requireRole(["professional"]);
  const d = await getOnboardingData(user.id);
  if (!d.pro) return <PageHeader title="Profile" sub="Finish setup first."><Link href="/workspace/onboarding/profile" className="inline-flex h-12 items-center rounded-control bg-forest px-6 font-bold text-white">Start setup</Link></PageHeader>;
  const [categories, states] = await Promise.all([listCategories(), listLocations(null)]);
  return (
    <div className="space-y-12">
      <PageHeader title="Profile" sub="What customers see on your public profile, plus your business details." />
      <ProfileStep d={d} categories={categories} states={states} userId={user.id} businessBanner={false} manage />
      <section aria-labelledby="all"><h2 id="all" className="text-xl font-extrabold">All workspace sections</h2><ul className="mt-4 grid gap-2 sm:grid-cols-2">{WORKSPACE_NAV.map((n) => <li key={n.key}><Link href={n.href} className="flex h-12 items-center rounded-2xl bg-surface px-4 font-bold text-forest shadow-soft hover:bg-mint-100">{n.label}</Link></li>)}</ul></section>
    </div>
  );
}
