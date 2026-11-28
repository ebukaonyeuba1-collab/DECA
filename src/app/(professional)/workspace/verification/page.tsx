import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/status-badge";
import { PageHeader, when } from "@/components/workspace/ui";
import { ViewDocumentButton } from "@/components/onboarding/uploaders";
import { describeEvent } from "@/lib/admin-verification";
import type { VerificationStatus } from "@/lib/domain";
import { POLICY_TITLES, isPolicyKey } from "@/lib/policies";
import { requireRole } from "@/server/auth/session";
import { requireProfessional } from "@/server/workspace/queries";
import { getOnboardingData } from "@/server/onboarding/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification" };
const EDIT = ["not_started", "incomplete", "additional_information_required"];

export default async function Page() {
  await requireProfessional(); const user = await requireRole(["professional"]);
  const d = await getOnboardingData(user.id);
  const reqName = new Map(d.reqs.map((r) => [r.id, r]));
  return (
    <div className="space-y-8">
      <PageHeader title="Verification" sub="Badges show only what DECA reviewers have individually accepted. Your documents are private." />
      <section className="rounded-card bg-surface p-6 shadow-soft"><p className="flex flex-wrap items-center gap-3 text-xl font-extrabold">Status <VerificationBadge status={d.status as VerificationStatus} /></p>
        {d.application?.decision_reason && <p className="mt-3 rounded-2xl bg-warning/10 p-3 text-sm"><b>Message from DECA:</b> {d.application.decision_reason}</p>}
        {EDIT.includes(d.status) ? <Link href="/workspace/onboarding/documents" className="mt-4 inline-flex h-12 items-center rounded-control bg-forest px-6 font-bold text-white">Manage documents</Link> : <p className="mt-3 text-sm text-ink-muted">Submitted evidence is locked while DECA reviews it. If more is needed, DECA will reopen your application.</p>}</section>
      <section aria-labelledby="docs"><h2 id="docs" className="text-xl font-extrabold">Your documents</h2>
        {d.docs.length === 0 ? <p className="mt-3 text-ink-muted">No documents uploaded yet.</p> : <ul className="mt-3 space-y-3">{d.docs.map((x) => <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-soft"><div><p className="font-bold">{(x.requirement_id && reqName.get(x.requirement_id)?.name) || "Supporting document"}</p><p className="text-sm text-ink-muted">{x.file_name}</p>{x.review_note && <p className="text-sm text-danger">Reviewer note: {x.review_note}</p>}</div><span className="flex items-center gap-3"><Badge tone={x.review_status === "accepted" ? "success" : x.review_status === "rejected" ? "danger" : "warning"}>{!x.uploaded_at ? "Upload not finished" : x.review_status === "pending" ? "Awaiting review" : x.review_status}</Badge>{x.uploaded_at && <ViewDocumentButton documentId={x.id} />}</span></li>)}</ul>}</section>
      {d.events.length > 0 && <section aria-labelledby="hist"><h2 id="hist" className="text-xl font-extrabold">History</h2><ol className="mt-3 space-y-3 border-l-2 border-mint pl-5">{d.events.map((e, i) => { const x = describeEvent({ event_type: e.event_type, from_status: null, to_status: null, message: e.message }); return <li key={i}><p className="font-bold">{x.title}</p>{x.detail && <p className="text-sm">{x.detail}</p>}<p className="text-xs text-ink-muted">{when(e.created_at)}</p></li>; })}</ol></section>}
      <section aria-labelledby="pol"><h2 id="pol" className="text-xl font-extrabold">Policies you accepted</h2><ul className="mt-3 flex flex-wrap gap-2">{d.requiredPolicies.filter(isPolicyKey).map((k) => <li key={k}><Badge tone={d.acceptedPolicies.has(k) ? "success" : "warning"}>{POLICY_TITLES[k]}{d.acceptedPolicies.has(k) ? "" : " (not accepted)"}</Badge></li>)}</ul></section>
    </div>
  );
}
