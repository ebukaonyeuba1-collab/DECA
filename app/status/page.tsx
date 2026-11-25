import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider, protectedPaymentsEnabled } from "@/server/payments/registry";

export const dynamic = "force-dynamic";

async function readStatus() {
  if (!isSupabaseConfigured()) return { db: "Not configured. Copy .env.example to .env.local.", categories: null as number | null, states: null as number | null };
  try {
    const supabase = await createClient();
    const [c, s] = await Promise.all([
      supabase.from("service_categories").select("id", { count: "exact", head: true }),
      supabase.from("locations").select("id", { count: "exact", head: true }).eq("level", "state"),
    ]);
    if (c.error) return { db: `Connected, but query failed: ${c.error.message}`, categories: null, states: null };
    return { db: "Connected", categories: c.count, states: s.count };
  } catch (e) { return { db: `Unreachable: ${(e as Error).message}`, categories: null, states: null }; }
}

export default async function Home() {
  const s = await readStatus();
  const pay = getPaymentProvider();
  const rows: [string, string][] = [
    ["Database", s.db],
    ["Service categories (seeded)", s.categories == null ? "n/a" : String(s.categories)],
    ["States (seeded)", s.states == null ? "n/a" : String(s.states)],
    ["Payment provider", pay.available ? `${pay.provider.id} (${pay.provider.isSandbox ? "sandbox" : "LIVE"})` : `Unavailable: ${pay.reason}`],
    ["Protected payments", protectedPaymentsEnabled() ? "Enabled" : "Off (no custody or escrow claims)"],
    ["Identity verification", "Manual review by DECA administrators"],
  ];
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-bold text-forest-700">Stage 1 foundation</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">DECA</h1>
      <p className="mt-2 text-ink-muted">Good work starts with the right connection.</p>
      <dl className="mt-10 divide-y divide-line rounded-card bg-surface shadow-soft">
        {rows.map(([k, v]) => <div key={k} className="flex flex-col gap-1 p-5 sm:flex-row sm:justify-between"><dt className="font-bold">{k}</dt><dd className="text-ink-muted sm:text-right">{v}</dd></div>)}
      </dl>
      <div className="mt-8 flex gap-3">
        <Link className="rounded-control bg-forest px-6 py-3 font-bold text-white" href="/login">Sign in</Link>
        <Link className="rounded-control px-6 py-3 font-bold text-forest ring-2 ring-inset ring-forest" href="/register">Create account</Link>
      </div>
      <p className="mt-10 text-sm text-ink-muted">Developer status page. The public marketplace lives at the home page.</p>
    </main>
  );
}
