import { Notice } from "@/components/marketplace/notice";
import { PageHeader, when } from "@/components/workspace/ui";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { requireProfessional, listQuotations } from "@/server/workspace/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotations" };
const tone = (s: string) => (s === "accepted" ? "success" : s === "rejected" || s === "expired" || s === "withdrawn" ? "danger" : s === "sent" ? "warning" : "neutral") as "success" | "danger" | "warning" | "neutral";
export default async function Page() {
  await requireProfessional();
  const rows = await listQuotations().catch(() => null);
  if (!rows) return <Notice title="We could not load quotations">Please try again in a moment.</Notice>;
  return (
    <div><PageHeader title="Quotations" sub="Quotes you have prepared and sent. The quotation builder arrives with messaging in the next stage." />
      {rows.length === 0 ? <Notice title="No quotations yet" /> : <ul className="divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{rows.map((q) => <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-extrabold">{q.number} · {q.customerName}</p><p className="text-sm text-ink-muted">{q.sent_at ? `Sent ${when(q.sent_at)}` : `Created ${when(q.created_at)}`}{q.valid_until ? ` · valid until ${when(q.valid_until)}` : ""}</p></div><div className="flex items-center gap-3"><b>{formatMoney(q.total_minor, q.currency)}</b><Badge tone={tone(q.status)}>{q.status}</Badge></div></li>)}</ul>}
    </div>
  );
}
