import { Notice } from "@/components/marketplace/notice";
import { ActionForm } from "@/components/onboarding/action-form";
import { PageHeader, when } from "@/components/workspace/ui";
import { BookingBadge } from "@/components/ui/status-badge";
import type { BookingStatus } from "@/lib/domain";
import { formatMoney } from "@/lib/money";
import { JOB_NOTE_STATUSES, jobActionsFor } from "@/lib/workspace";
import { requireProfessional, listBookings } from "@/server/workspace/queries";
import { addJobUpdate, updateJobStatus } from "@/server/workspace/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs" };
type Row = Awaited<ReturnType<typeof listBookings>>[number];
const GROUPS: [string, string[]][] = [["Upcoming", ["confirmed", "awaiting_payment", "payment_secured", "scheduled"]], ["In progress", ["in_progress", "awaiting_customer_confirmation"]], ["Completed", ["completed"]], ["Cancelled, disputed or refunded", ["cancelled", "disputed", "refunded"]]];

function Job({ b }: { b: Row }) {
  const actions = jobActionsFor(b.status as BookingStatus);
  return (
    <li className="rounded-card bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-ink-muted">{b.reference} · {b.customerName}</p><h3 className="text-lg font-extrabold">{b.title}</h3><p className="text-sm text-ink-muted">{b.scheduled_start ? `Scheduled ${when(b.scheduled_start)}` : "Not scheduled"}{b.agreed_amount_minor != null ? ` · ${formatMoney(b.agreed_amount_minor, b.currency)}` : ""}</p></div><BookingBadge status={b.status as BookingStatus} /></div>
      {b.updates.length > 0 && <ul className="mt-3 space-y-1 text-sm">{b.updates.map((u, i) => <li key={i} className="text-ink-muted">{when(u.created_at)}: {u.message}</li>)}</ul>}
      {actions.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{actions.map((a) => <ActionForm key={a.to} action={updateJobStatus} submitLabel={a.label} secondary={a.danger} className="flex items-center gap-2"><input type="hidden" name="id" value={b.id} /><input type="hidden" name="to" value={a.to} /></ActionForm>)}</div>}
      {(JOB_NOTE_STATUSES as string[]).includes(b.status) && <ActionForm action={addJobUpdate} submitLabel="Add update" secondary className="mt-4 flex flex-wrap items-end gap-3"><input type="hidden" name="id" value={b.id} /><label className="min-w-0 flex-1 text-sm font-bold">Progress update for your records<input name="message" required maxLength={1000} className="mt-1 h-11 w-full rounded-xl border-2 border-line px-3 font-normal" /></label></ActionForm>}
      {b.status === "awaiting_customer_confirmation" && <p className="mt-3 text-sm text-ink-muted">Waiting for the customer to confirm the job is complete.</p>}
    </li>
  );
}
export default async function Page() {
  await requireProfessional();
  const rows = await listBookings(GROUPS.flatMap(([, s]) => s)).catch(() => null);
  if (!rows) return <Notice title="We could not load jobs">Please try again in a moment.</Notice>;
  return (
    <div className="space-y-10"><PageHeader title="Jobs" sub="Bookings from confirmation to completion. Only the customer can confirm a job is complete." />
      {rows.length === 0 && <Notice title="No jobs yet">Approved quotations become jobs here.</Notice>}
      {GROUPS.map(([label, statuses]) => { const g = rows.filter((r) => statuses.includes(r.status)); return g.length === 0 ? null : <section key={label} aria-labelledby={`g-${label}`}><h2 id={`g-${label}`} className="mb-3 text-xl font-extrabold">{label} ({g.length})</h2><ul className="space-y-4">{g.map((b) => <Job key={b.id} b={b} />)}</ul></section>; })}
    </div>
  );
}
