import Link from "next/link";
import { Metric, PageHeader, when } from "@/components/workspace/ui";
import { VerificationBadge } from "@/components/ui/status-badge";
import { Rating } from "@/components/marketplace/rating";
import { describeEvent } from "@/lib/admin-verification";
import { formatMoney } from "@/lib/money";
import { nextStep } from "@/lib/onboarding-steps";
import type { VerificationStatus } from "@/lib/domain";
import { COMPLETION_LABEL, netEarningsMinor, profileCompletion, type Dashboard } from "@/lib/workspace";
import { requireRole } from "@/server/auth/session";
import { getOnboardingData } from "@/server/onboarding/queries";
import { getDashboard } from "@/server/workspace/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function Workspace({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const user = await requireRole(["professional"]);
  const [d, sp] = await Promise.all([getOnboardingData(user.id), searchParams]);
  const dash: Dashboard = d.pro ? await getDashboard().catch(() => ({})) : {};
  const status = d.status as VerificationStatus;
  const open = ["not_started", "incomplete", "additional_information_required"].includes(status);
  const done = (k: string) => d.steps.find((s) => s.key === k)?.done ?? false;
  const completion = profileCompletion({ displayName: !!d.pro?.display_name, headline: !!d.pro?.headline, bio: !!d.pro?.bio, experience: d.pro?.years_experience != null, category: !!d.pro?.primary_category_id, photo: !!d.profile?.avatar_path, services: done("services"), coverage: done("coverage"), portfolio: done("portfolio"), availability: done("availability"), documents: done("documents") });
  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome${user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}`} sub="Everything here is calculated from your real records. Nothing is estimated." />
      {sp.submitted && <p role="status" className="rounded-2xl bg-success/15 p-4 font-semibold text-success">Application submitted. DECA will review your documents.</p>}

      <section aria-labelledby="vs" className="rounded-card bg-surface p-6 shadow-soft">
        <h2 id="vs" className="flex flex-wrap items-center gap-3 text-xl font-extrabold">Verification <VerificationBadge status={status} /></h2>
        {d.application?.decision_reason && <p className="mt-3 rounded-2xl bg-warning/10 p-3 text-sm"><b>Message from DECA:</b> {d.application.decision_reason}</p>}
        {status === "approved" && <p className="mt-3 text-sm text-ink-muted">You are approved{d.pro?.is_listed ? " and listed publicly" : ""}.{d.pro?.slug && <> <Link className="font-bold text-forest underline" href={`/professionals/${d.pro.slug}`}>View your public profile</Link></>}</p>}
        {status === "under_review" && d.application && <p className="mt-3 text-sm text-ink-muted">Your profile is being reviewed. It stays hidden from search until a reviewer decides.</p>}
        {open && <Link href={`/workspace/onboarding/${nextStep(d.steps)}`} className="mt-4 inline-flex h-12 items-center rounded-control bg-forest px-6 font-bold text-white">{d.pro ? "Continue setup" : "Start setting up"}</Link>}
      </section>

      {d.pro && <>
        <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric label="New enquiries" value={dash.enquiries_new ?? 0} href="/workspace/enquiries" />
          <Metric label="Quotes awaiting customer" value={dash.quotations_pending ?? 0} href="/workspace/quotations" hint={dash.quotations_draft ? `${dash.quotations_draft} draft` : undefined} />
          <Metric label="Upcoming bookings" value={dash.bookings_upcoming ?? 0} href="/workspace/jobs" />
          <Metric label="Active jobs" value={dash.jobs_active ?? 0} href="/workspace/jobs" />
          <Metric label="Completed jobs" value={dash.jobs_completed ?? 0} href="/workspace/jobs" />
          <Metric label="Unread messages" value={dash.unread_messages ?? 0} href="/workspace/messages" />
          <Metric label="Rating" value={<Rating avg={Number(dash.rating_avg ?? 0)} count={Number(dash.review_count ?? 0)} />} />
          <Metric label="Net earnings" value={formatMoney(netEarningsMinor(dash))} href="/workspace/earnings" hint={dash.payout_pending_minor ? `${formatMoney(dash.payout_pending_minor)} payout pending` : undefined} />
        </section>
        <section aria-labelledby="pc" className="rounded-card bg-surface p-6 shadow-soft">
          <h2 id="pc" className="text-xl font-extrabold">Profile completion: {completion.percent}%</h2>
          <div className="mt-3 h-3 overflow-hidden rounded-control bg-mint-100" role="progressbar" aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><div className="h-full rounded-control bg-forest" style={{ width: `${completion.percent}%` }} /></div>
          {completion.missing.length > 0 && <ul className="mt-4 grid gap-2 sm:grid-cols-2">{completion.missing.slice(0, 6).map((k) => <li key={k}><Link href={COMPLETION_LABEL[k].href} className="flex h-11 items-center rounded-2xl bg-mint-50 px-4 text-sm font-bold text-forest hover:bg-mint-100">{COMPLETION_LABEL[k].text}</Link></li>)}</ul>}
        </section>
      </>}

      {d.events.length > 0 && <section aria-labelledby="ev"><h2 id="ev" className="text-xl font-extrabold">Recent activity</h2><ul className="mt-3 divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{d.events.map((e, i) => { const x = describeEvent({ event_type: e.event_type, from_status: null, to_status: null, message: e.message }); return <li key={i} className="py-3 text-sm"><b>{x.title}</b>{x.detail ? `: ${x.detail}` : ""}<time className="ml-2 text-ink-muted" dateTime={e.created_at}>{when(e.created_at)}</time></li>; })}</ul></section>}
    </div>
  );
}
