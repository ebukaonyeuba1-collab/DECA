"use client";
import { useState } from "react";
import type { CategoryRow } from "@/server/discovery/types";

const sel = "h-12 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base";
const lab = "mb-1.5 block text-sm font-bold";
export type ServiceDefaults = { name?: string; categoryId?: string | null; subcategoryId?: string | null; description?: string | null; inclusions?: string | null; exclusions?: string | null; pricingType?: string; price?: string; minimumCharge?: string; durationMinutes?: number | null; additionalCharges?: string | null };

/** Category, subcategory and pricing: the price field appears only for priced types. Used to add and to edit a service. */
export function ServiceFields({ categories, defaultCategoryId, defaults }: { categories: CategoryRow[]; defaultCategoryId?: string | null; defaults?: ServiceDefaults }) {
  const [cat, setCat] = useState(defaults?.categoryId ?? defaultCategoryId ?? ""); const [type, setType] = useState(defaults?.pricingType ?? "starting");
  const current = categories.find((c) => c.id === cat); const subs = current?.subcategories ?? [];
  const priced = ["fixed", "starting", "hourly", "daily"].includes(type);
  return (
    <>
      <div><label htmlFor="svc-name" className={lab}>Service name</label><input id="svc-name" name="name" required maxLength={100} defaultValue={defaults?.name} className={sel} placeholder="e.g. Leak detection and repair" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="svc-cat" className={lab}>Category</label><select id="svc-cat" name="categoryId" required className={sel} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="svc-sub" className={lab}>Specialisation</label><select key={cat} id="svc-sub" name="subcategoryId" className={sel} disabled={subs.length === 0} defaultValue={defaults?.subcategoryId ?? ""}><option value="">{subs.length ? "Any" : "None"}</option>{subs.map((s, i) => <option key={s.slug} value={(current?.subcategoryIds ?? [])[i]}>{s.name}</option>)}</select></div>
      </div>
      <div><label htmlFor="svc-desc" className={lab}>Description</label><textarea id="svc-desc" name="description" maxLength={1000} rows={3} defaultValue={defaults?.description ?? ""} className={`${sel} h-auto py-3`} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="svc-inc" className={lab}>Includes</label><input id="svc-inc" name="inclusions" maxLength={500} defaultValue={defaults?.inclusions ?? ""} className={sel} /></div><div><label htmlFor="svc-exc" className={lab}>Excludes</label><input id="svc-exc" name="exclusions" maxLength={500} defaultValue={defaults?.exclusions ?? ""} className={sel} /></div></div>
      <div><label htmlFor="svc-type" className={lab}>How do you price this?</label>
        <select id="svc-type" name="pricingType" className={sel} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="starting">Starting price</option><option value="fixed">Fixed price</option><option value="hourly">Hourly rate</option><option value="daily">Daily rate</option><option value="per_project">Quotation per project</option><option value="inspection_based">Quotation after inspection</option></select></div>
      {priced && <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="svc-price" className={lab}>Price (₦)</label><input id="svc-price" name="price" inputMode="decimal" required defaultValue={defaults?.price} className={sel} placeholder="8500" /></div><div><label htmlFor="svc-min" className={lab}>Minimum charge (₦, optional)</label><input id="svc-min" name="minimumCharge" inputMode="decimal" defaultValue={defaults?.minimumCharge} className={sel} /></div></div>}
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="svc-dur" className={lab}>Typical duration (minutes, optional)</label><input id="svc-dur" name="durationMinutes" type="number" min={5} max={1440} defaultValue={defaults?.durationMinutes ?? ""} className={sel} /></div><div><label htmlFor="svc-add" className={lab}>Additional charges (optional)</label><input id="svc-add" name="additionalCharges" maxLength={300} defaultValue={defaults?.additionalCharges ?? ""} className={sel} placeholder="e.g. materials at cost" /></div></div>
    </>
  );
}
