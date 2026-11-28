import Link from "next/link";
import { ALL_STATUSES, type AdminParams } from "@/lib/admin-verification";
import { VERIFICATION_LABEL } from "@/lib/domain";
import type { CategoryRow, LocationOption } from "@/server/discovery/types";
import { LocationSelect } from "@/components/onboarding/location-select";
import { Button } from "@/components/ui/button";

const inp = "h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base";
const lab = "mb-1 block text-sm font-bold";

export function VerificationFilters({ params, categories, states }: { params: AdminParams; categories: CategoryRow[]; states: LocationOption[] }) {
  const active = [params.q, params.status, params.category, params.loc].filter(Boolean).length;
  return (
    <details className="rounded-card bg-surface p-4 shadow-soft lg:open:block" open={active > 0}>
      <summary className="cursor-pointer font-extrabold">Search and filter{active > 0 ? ` (${active} active)` : ""}</summary>
      <form action="/admin/verification" className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {params.group !== "pending" && <input type="hidden" name="group" value={params.group} />}
        <div><label htmlFor="av-q" className={lab}>Name, business or email</label><input id="av-q" name="q" defaultValue={params.q} maxLength={80} className={inp} placeholder="Search" /></div>
        <div><label htmlFor="av-status" className={lab}>Verification status</label><select id="av-status" name="status" defaultValue={params.status ?? ""} className={inp}><option value="">Any in this view</option>{ALL_STATUSES.map((s) => <option key={s} value={s}>{VERIFICATION_LABEL[s]}</option>)}</select></div>
        <div><label htmlFor="av-cat" className={lab}>Category</label><select id="av-cat" name="category" defaultValue={params.category ?? ""} className={inp}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
        <LocationSelect states={states} name="l" label="Location" initialId={params.loc ?? null} initialLabel={params.loc ? "Selected area" : null} />
        <div className="flex gap-3 md:col-span-2 lg:col-span-4"><Button type="submit">Apply</Button><Link href={`/admin/verification${params.group !== "pending" ? `?group=${params.group}` : ""}`} className="inline-flex h-12 items-center rounded-control px-5 font-bold text-forest ring-2 ring-inset ring-forest">Clear filters</Link></div>
      </form>
    </details>
  );
}
