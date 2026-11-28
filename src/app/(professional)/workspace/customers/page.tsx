import { Notice } from "@/components/marketplace/notice";
import { ActionForm } from "@/components/onboarding/action-form";
import { PageHeader, when } from "@/components/workspace/ui";
import { requireProfessional, listCustomers } from "@/server/workspace/queries";
import { saveCustomerNote } from "@/server/workspace/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };
export default async function Page() {
  await requireProfessional();
  const rows = await listCustomers().catch(() => null);
  if (!rows) return <Notice title="We could not load customers">Please try again in a moment.</Notice>;
  return (
    <div><PageHeader title="Customers" sub="People you have worked with through DECA. Contact details stay private; talk to them through DECA messaging. Your notes are visible only to you." />
      {rows.length === 0 ? <Notice title="No customers yet" /> : <ul className="space-y-4">{rows.map((c) => (
        <li key={c.customer_id} className="rounded-card bg-surface p-5 shadow-soft"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-extrabold">{c.display_name}</h2><p className="text-sm text-ink-muted">{c.bookings_count} booking{Number(c.bookings_count) === 1 ? "" : "s"} · {c.completed_count} completed{c.last_booking_at ? ` · last ${when(c.last_booking_at)}` : ""}</p></div>
          <ActionForm action={saveCustomerNote} submitLabel="Save note" secondary className="mt-3 space-y-2"><input type="hidden" name="customerId" value={c.customer_id} /><label className="block text-sm font-bold" htmlFor={`n-${c.customer_id}`}>Private note</label><textarea id={`n-${c.customer_id}`} name="note" maxLength={2000} rows={2} defaultValue={c.note ?? ""} className="w-full rounded-xl border-2 border-line px-3 py-2" /></ActionForm>
        </li>))}</ul>}
    </div>
  );
}
