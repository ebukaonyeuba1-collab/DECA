import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/onboarding/action-form";
import { AdminDocButton } from "@/components/onboarding/admin-doc-button";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/status-badge";
import type { VerificationStatus } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/server/auth/session";
import { decideApplicationAction, reviewDocumentAction } from "@/server/admin/verification";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review application" };
const inp = "h-11 w-full rounded-xl border-2 border-line bg-surface px-3";

export default async function Review({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin", "super_admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: app } = await supabase.from("verification_applications").select("id,status,professional_id,decision_reason,internal_notes,submitted_at").eq("id", id).maybeSingle();
  if (!app) notFound();
  const [pro, docs, reqs] = await Promise.all([
    supabase.from("professional_profiles").select("display_name,slug,account_type,years_experience,bio").eq("id", app.professional_id).maybeSingle(),
    supabase.from("professional_documents").select("id,requirement_id,file_name,mime_type,size_bytes,review_status,review_note,uploaded_at").eq("professional_id", app.professional_id).is("deleted_at", null).order("created_at"),
    supabase.rpc("applicable_requirements", { p_professional: app.professional_id }),
  ]);
  const name = new Map(((reqs.data ?? []) as { id: string; name: string; is_required: boolean }[]).map((r) => [r.id, r]));
  const list = (docs.data ?? []) as { id: string; requirement_id: string | null; file_name: string; mime_type: string | null; size_bytes: number | null; review_status: string; review_note: string | null; uploaded_at: string | null }[];
  return (
    <div className="space-y-8">
      <Link href="/admin/verification" className="text-sm font-bold text-forest">Back to queue</Link>
      <header><h1 className="text-3xl font-extrabold">{pro.data?.display_name}</h1><p className="mt-1 flex items-center gap-3 text-ink-muted"><span className="capitalize">{pro.data?.account_type}</span><VerificationBadge status={app.status as VerificationStatus} /></p>{pro.data?.bio && <p className="mt-3 max-w-2xl text-sm">{pro.data.bio}</p>}</header>
      <section aria-labelledby="docs"><h2 id="docs" className="text-xl font-extrabold">Documents</h2>
        <ul className="mt-4 space-y-4">{list.map((x) => { const r = x.requirement_id ? name.get(x.requirement_id) : null; return (
          <li key={x.id} className="rounded-card bg-surface p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-extrabold">{r?.name ?? "Other supporting document"} {r && <Badge tone={r.is_required ? "warning" : "neutral"}>{r.is_required ? "Required" : "Optional"}</Badge>}</p><p className="text-sm text-ink-muted">{x.file_name} · {x.mime_type} · {x.size_bytes ? `${Math.round(x.size_bytes / 1024)} KB` : ""}</p></div>
              <span className="flex items-center gap-3">{x.uploaded_at ? <AdminDocButton documentId={x.id} /> : <Badge tone="warning">Upload unfinished</Badge>}<Badge tone={x.review_status === "accepted" ? "success" : x.review_status === "rejected" ? "danger" : "neutral"}>{x.review_status}</Badge></span></div>
            {x.uploaded_at && <ActionForm action={reviewDocumentAction} submitLabel="Save decision" secondary className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"><input type="hidden" name="id" value={x.id} />
              <div><label className="mb-1 block text-sm font-bold" htmlFor={`s${x.id}`}>Decision</label><select id={`s${x.id}`} name="status" defaultValue={x.review_status} className={inp}><option value="accepted">Accept</option><option value="rejected">Reject</option><option value="pending">Pending</option></select></div>
              <div><label className="mb-1 block text-sm font-bold" htmlFor={`n${x.id}`}>Note to professional (required to reject)</label><input id={`n${x.id}`} name="note" defaultValue={x.review_note ?? ""} className={inp} maxLength={500} /></div></ActionForm>}
          </li>); })}</ul>{list.length === 0 && <p className="mt-3 text-ink-muted">No documents uploaded.</p>}</section>
      <section aria-labelledby="dec" className="rounded-card bg-mint-50 p-5 ring-1 ring-line"><h2 id="dec" className="text-xl font-extrabold">Application decision</h2>
        <p className="mb-4 text-sm text-ink-muted">Approval needs every required document accepted. Rejection and information requests need a reason, which the professional sees.</p>
        <ActionForm action={decideApplicationAction} submitLabel="Record decision"><input type="hidden" name="id" value={app.id} />
          <div><label htmlFor="dc" className="mb-1 block text-sm font-bold">Decision</label><select id="dc" name="decision" className={inp} defaultValue="under_review"><option value="under_review">Mark under review</option><option value="additional_information_required">Request more information</option><option value="approved">Approve</option><option value="rejected">Reject</option><option value="suspended">Suspend</option></select></div>
          <div><label htmlFor="rs" className="mb-1 block text-sm font-bold">Reason (shown to the professional)</label><input id="rs" name="reason" defaultValue={app.decision_reason ?? ""} className={inp} maxLength={500} /></div>
          <div><label htmlFor="nt" className="mb-1 block text-sm font-bold">Internal notes (admins only)</label><textarea id="nt" name="notes" defaultValue={app.internal_notes ?? ""} className={`${inp} h-24 py-2`} maxLength={1000} /></div></ActionForm></section>
    </div>
  );
}
