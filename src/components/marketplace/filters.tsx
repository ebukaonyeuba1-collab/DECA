import Link from "next/link";
import { SORTS, SORT_LABEL, type DiscoveryParams } from "@/lib/discovery-params";
import type { SelectedLocation } from "@/lib/cookie-state";
import type { CategoryRow, LocationOption } from "@/server/discovery/types";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "./location-picker";

const sel = "h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base";
const lab = "mb-1.5 block text-sm font-bold";

export function Filters({ params, categories, states, location, action }: { params: DiscoveryParams; categories: CategoryRow[]; states: LocationOption[]; location: SelectedLocation | null; action: string }) {
  return (
    <form action={action} className="space-y-4">
      <div><label htmlFor="f-q" className={lab}>Search</label><input id="f-q" name="q" defaultValue={params.q} maxLength={80} className={sel} placeholder="Name or service" /></div>
      {action === "/explore" && <div><label htmlFor="f-cat" className={lab}>Category</label><select id="f-cat" name="category" defaultValue={params.category ?? ""} className={sel}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>}
      {params.sub && <input type="hidden" name="sub" value={params.sub} />}
      <fieldset><legend className={lab}>Location</legend><LocationPicker states={states} current={location} variant="field" /></fieldset>
      <div><label htmlFor="f-rating" className={lab}>Rating</label><select id="f-rating" name="rating" defaultValue={params.rating ?? ""} className={sel}><option value="">Any</option><option value="3">3.0 and up</option><option value="4">4.0 and up</option><option value="4.5">4.5 and up</option></select></div>
      <div><label htmlFor="f-ver" className={lab}>Verification</label><select id="f-ver" name="verified" defaultValue={params.verified ?? ""} className={sel}><option value="">Any</option><option value="identity">Identity verified</option><option value="credentials">Credentials verified</option><option value="experience">Experience verified</option></select></div>
      <div><label htmlFor="f-yrs" className={lab}>Experience</label><select id="f-yrs" name="years" defaultValue={params.years ?? ""} className={sel}><option value="">Any</option><option value="2">2+ years</option><option value="5">5+ years</option><option value="10">10+ years</option></select></div>
      <div><label htmlFor="f-price" className={lab}>Starting price up to (₦)</label><input id="f-price" name="maxPrice" type="number" min={1} max={10000000} inputMode="numeric" defaultValue={params.maxPrice} className={sel} placeholder="No limit" /></div>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="avail" value="1" defaultChecked={params.avail} className="h-5 w-5 accent-forest" />Available today</label>
      <div><label htmlFor="f-sort" className={lab}>Sort by</label><select id="f-sort" name="sort" defaultValue={params.sort} className={sel}>{SORTS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}</select></div>
      <div className="flex gap-3"><Button type="submit" className="flex-1">Apply filters</Button><Link href={action === "/explore" ? "/explore?l=" : action} className="inline-flex h-12 items-center rounded-control px-5 font-bold text-forest ring-2 ring-inset ring-forest">Clear</Link></div>
    </form>
  );
}
