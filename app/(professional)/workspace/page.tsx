import Link from "next/link";
import { VerificationBadge } from "@/components/ui/status-badge";
import { nextStep } from "@/lib/onboarding-steps";
import type { VerificationStatus } from "@/lib/domain";
import { requireRole } from "@/server/auth/session";
import { getOnboardingData } from "@/server/onboarding/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Professional workspace" };

const EVENT: Record<string, string> = { submitted: "Application submitted", admin_decision: "DECA decision", document_accepted: "A document was accepted", document_rejected: "A document needs replacing", submit_blocked: "Submission incomplete" };

export default async function Workspace({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const user = await requireRole(["professional"]);
  const [d, sp] = await Promise.all([getOnboardingData(user.id), searchParams]);
  const status = d.status as VerificationStatus;
  const cta = ["not_started", "incomplete", "additional_information_required"].includes(status);
  return (
    <div className="space-y-8">
      <header><h1 className="text-3xl font-extrabold">Welcome{user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}</h1><p className="mt-1 text-ink-muted">Your professional workspace. Bookings, quotations and earnings arrive in the next stage.</p></header>
      {sp.submitted && <p role="status" className="rounded-2xl bg-success/15 p-4 font-semibold text-success">Application submitted. DECA will review your documents.</p>}
      <section className="rounded-card bg-surface p-6 shadow-soft" aria-labelledby="vs">
        <h2 id="vs" className="flex flex-wrap items-center gap-3 text-xl font-extrabold">Verification <VerificationBadge status={status} /></h2>
        {d.application?.decision_reason && <p className="mt-3 rounded-2xl bg-warning/10 p-3 text-sm"><b>Message from DECA:</b> {d.application.decision_reason}</p>}
        {status === "approved" && <p className="mt-3 text-sm text-ink-muted">You are approved{d.pro?.is_listed ? " and listed publicly" : ""}.{d.pro?.slug && <> <Link className="font-bold text-forest underline" href={`/professionals/${d.pro.slug}`}>View your public profile</Link></>}</p>}
        {cta && <Link href={`/workspace/onboarding/${nextStep(d.steps)}`} className="mt-4 inline-flex h-12 items-center rounded-control bg-forest px-6 font-bold text-white">{d.pro ? "Continue setup" : "Start setting up"}</Link>}
        {d.steps.length > 0 && <ol className="mt-5 grid gap-2 sm:grid-cols-2">{d.steps.map((s) => <li key={s.key}><Link href={`/workspace/onboarding/${s.key}`} className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3 text-sm font-bold">{s.label}<span className={s.done ? "text-success" : "text-ink-muted"}>{s.done ? "Done" : s.blocking ? "Needed" : "Optional"}</span></Link></li>)}</ol>}
      </section>
      {d.events.length > 0 && <section aria-labelledby="ev"><h2 id="ev" className="text-xl font-extrabold">Activity</h2><ul className="mt-3 divide-y divide-line">{d.events.map((e, i) => <li key={i} className="py-3 text-sm"><b>{EVENT[e.event_type] ?? e.event_type}</b>{e.message ? `: ${e.message}` : ""}<time className="ml-2 text-ink-muted" dateTime={e.created_at}>{new Date(e.created_at).toLocaleDateString("en-NG")}</time></li>)}</ul></section>}
    </div>
  );
}
