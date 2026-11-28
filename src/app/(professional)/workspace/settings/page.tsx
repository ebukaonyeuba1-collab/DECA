import Link from "next/link";
import { PageHeader } from "@/components/workspace/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/auth/actions";
import { getSubscription, requireProfessional } from "@/server/workspace/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };
export default async function Page() {
  const { user, professionalId } = await requireProfessional();
  const sub = await getSubscription(professionalId).catch(() => null);
  return (
    <div className="max-w-2xl space-y-8"><PageHeader title="Settings" />
      <section className="rounded-card bg-surface p-6 shadow-soft"><h2 className="text-xl font-extrabold">Account</h2><dl className="mt-3 space-y-2"><div className="flex justify-between gap-4"><dt className="font-bold text-ink-muted">Email</dt><dd>{user.email}</dd></div><div className="flex justify-between gap-4"><dt className="font-bold text-ink-muted">Role</dt><dd>Professional</dd></div></dl>
        <p className="mt-4 text-sm"><Link href="/forgot-password" className="font-bold text-forest underline">Change your password</Link> (we will email you a link).</p></section>
      <section className="rounded-card bg-surface p-6 shadow-soft"><h2 className="text-xl font-extrabold">Plan</h2><p className="mt-3 flex items-center gap-3"><b>{sub?.subscription_plans?.name ?? "Free"}</b><Badge tone="success">{sub?.status ?? "active"}</Badge></p><p className="mt-2 text-sm text-ink-muted">Paid plans are not available yet. Your plan never affects verification or how you are ranked.</p></section>
      <section className="rounded-card bg-surface p-6 shadow-soft"><h2 className="text-xl font-extrabold">Privacy</h2><p className="mt-2 text-sm text-ink-muted">Your email, phone number and verification documents are never shown publicly. <Link href="/legal/privacy_policy" className="font-bold text-forest underline">Read the privacy policy (draft)</Link>.</p></section>
      <form action={signOut}><Button variant="secondary">Sign out</Button></form>
    </div>
  );
}
