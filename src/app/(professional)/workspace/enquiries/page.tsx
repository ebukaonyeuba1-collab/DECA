import { Notice } from "@/components/marketplace/notice";
import { ActionForm } from "@/components/onboarding/action-form";
import { PageHeader, when } from "@/components/workspace/ui";
import { BookingBadge } from "@/components/ui/status-badge";
import type { BookingStatus } from "@/lib/domain";
import { jobActionsFor } from "@/lib/workspace";
import { requireProfessional, listBookings } from "@/server/workspace/queries";
import { updateJobStatus } from "@/server/workspace/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enquiries" };
export default async function Page() {
  await requireProfessional();
  const rows = await listBookings(["quotation_requested", "awaiting_approval"]).catch(() => null);
  if (!rows) return <Notice title="We could not load enquiries">Please try again in a moment.</Notice>;
  return (
    <div>
      <PageHeader title="Enquiries" sub="Requests from customers. Replying, messaging and sending quotations arrive in the next stage; for now you can review and decline." />
      {rows.length === 0 ? <Notice title="No enquiries yet">When a customer asks for your help, it appears here.</Notice> : <ul className="space-y-4">{rows.map((b) => (
        <li key={b.id} className="rounded-card bg-surface p-5 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-ink-muted">{b.reference} · {b.customerName} · {when(b.created_at)}</p><h2 className="text-lg font-extrabold">{b.title}</h2>{b.description && <p className="mt-1 text-sm">{b.description}</p>}{b.address_text && <p className="mt-1 text-sm text-ink-muted">Location: {b.address_text}</p>}{b.scheduled_start && <p className="text-sm text-ink-muted">Preferred: {when(b.scheduled_start)}</p>}</div><BookingBadge status={b.status as BookingStatus} /></div>
          {jobActionsFor(b.status as BookingStatus).filter((a) => a.danger).map((a) => <ActionForm key={a.to} action={updateJobStatus} submitLabel={a.label} secondary className="mt-4 flex flex-wrap items-end gap-3"><input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value={a.to} /><label className="min-w-0 flex-1 text-sm font-bold">Reason (optional)<input name="note" maxLength={500} className="mt-1 h-11 w-full rounded-xl border-2 border-line px-3 font-normal" /></label></ActionForm>)}
        </li>))}</ul>}
    </div>
  );
}
