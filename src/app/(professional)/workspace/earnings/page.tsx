import { Notice } from "@/components/marketplace/notice";
import { Badge } from "@/components/ui/badge";
import { Metric, PageHeader, when } from "@/components/workspace/ui";
import { formatMoney } from "@/lib/money";
import { netEarningsMinor } from "@/lib/workspace";
import { getDashboard, getEarningsLists, requireProfessional } from "@/server/workspace/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings" };
export default async function Page() {
  await requireProfessional();
  const [dash, lists] = await Promise.all([getDashboard().catch(() => ({})), getEarningsLists().catch(() => null)]);
  if (!lists) return <Notice title="We could not load earnings">Please try again in a moment.</Notice>;
  const d = dash as Awaited<ReturnType<typeof getDashboard>>;
  return (
    <div className="space-y-10"><PageHeader title="Earnings" sub="Calculated from completed jobs and recorded payments. Payments and payouts are not active yet, so these figures stay at zero until real jobs are paid through DECA." />
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5"><Metric label="Completed job value" value={formatMoney(d.gross_completed_minor ?? 0)} /><Metric label="DECA commission" value={formatMoney(d.commission_minor ?? 0)} hint="Only recorded commission" /><Metric label="Net earnings" value={formatMoney(netEarningsMinor(d))} /><Metric label="Payout pending" value={formatMoney(d.payout_pending_minor ?? 0)} /><Metric label="Paid out" value={formatMoney(d.payout_paid_minor ?? 0)} /></section>
      <section aria-labelledby="tx"><h2 id="tx" className="text-xl font-extrabold">Transactions</h2>{lists.transactions.length === 0 ? <p className="mt-3 text-ink-muted">No transactions yet.</p> : <ul className="mt-3 divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{lists.transactions.map((t) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-bold">{t.provider_reference}</p><p className="text-sm text-ink-muted">{when(t.created_at)}</p></div><div className="flex items-center gap-3"><b>{formatMoney(t.amount_minor, t.currency)}</b>{t.is_sandbox && <Badge tone="warning">Test</Badge>}<Badge>{t.status}</Badge></div></li>)}</ul>}</section>
      <section aria-labelledby="po"><h2 id="po" className="text-xl font-extrabold">Payouts</h2>{lists.payouts.length === 0 ? <p className="mt-3 text-ink-muted">No payouts yet.</p> : <ul className="mt-3 divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{lists.payouts.map((p) => <li key={p.id} className="flex items-center justify-between py-3"><span>{when(p.created_at)}</span><span className="flex items-center gap-3"><b>{formatMoney(p.amount_minor, p.currency)}</b><Badge>{p.status}</Badge></span></li>)}</ul>}</section>
    </div>
  );
}
