import { Notice } from "@/components/marketplace/notice";
import { PageHeader, when } from "@/components/workspace/ui";
import { Badge } from "@/components/ui/badge";
import { requireProfessional, listConversations } from "@/server/workspace/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };
export default async function Page() {
  const { user } = await requireProfessional();
  const rows = await listConversations(user.id).catch(() => null);
  if (!rows) return <Notice title="We could not load messages">Please try again in a moment.</Notice>;
  return (
    <div><PageHeader title="Messages" sub="Conversations with customers, kept inside DECA. Reading and replying arrive in the next stage." />
      {rows.length === 0 ? <Notice title="No conversations yet" /> : <ul className="divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{rows.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="font-extrabold">{c.customerName}</p>{c.preview && <p className="truncate text-sm text-ink-muted">{c.preview}</p>}</div><div className="flex items-center gap-3 text-sm text-ink-muted">{c.unread > 0 && <Badge tone="warning">{c.unread} unread</Badge>}{when(c.last_message_at)}</div></li>)}</ul>}
    </div>
  );
}
