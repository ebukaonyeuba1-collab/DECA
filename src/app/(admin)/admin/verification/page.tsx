import Link from "next/link";
import { VerificationBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/lib/domain";
import { requireRole } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification queue" };

export default async function Queue() {
  await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("verification_applications").select("id,status,submitted_at,professional_profiles(display_name,account_type)").in("status", ["submitted", "under_review", "additional_information_required"]).order("submitted_at", { ascending: true });
  const rows = (data ?? []) as unknown as { id: string; status: VerificationStatus; submitted_at: string | null; professional_profiles: { display_name: string; account_type: string } | null }[];
  return (
    <div className="space-y-6"><h1 className="text-3xl font-extrabold">Verification queue</h1>
      {rows.length === 0 ? <p className="text-ink-muted">No applications waiting.</p> : <ul className="divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{rows.map((r) => <li key={r.id}><Link href={`/admin/verification/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4"><span><b>{r.professional_profiles?.display_name}</b> <span className="text-sm capitalize text-ink-muted">{r.professional_profiles?.account_type}</span></span><span className="flex items-center gap-3 text-sm text-ink-muted">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-NG") : ""}<VerificationBadge status={r.status} /></span></Link></li>)}</ul>}
    </div>
  );
}
