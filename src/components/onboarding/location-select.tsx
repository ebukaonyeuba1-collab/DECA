"use client";
import { useState } from "react";
import type { LocationOption } from "@/server/discovery/types";

const sel = "h-12 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base";
async function children(parent: string): Promise<LocationOption[]> {
  try { const r = await fetch(`/api/locations?parent=${parent}`); return r.ok ? (await r.json()).locations : []; } catch { return []; }
}

/** State, then city, then neighbourhood. Submits the most specific choice under `name`. */
export function LocationSelect({ states, name, label = "Location", required, initialId, initialLabel }: { states: LocationOption[]; name: string; label?: string; required?: boolean; initialId?: string | null; initialLabel?: string | null }) {
  const [stateId, setState] = useState(""); const [cityId, setCity] = useState(""); const [hoodId, setHood] = useState("");
  const [cities, setCities] = useState<LocationOption[]>([]); const [hoods, setHoods] = useState<LocationOption[]>([]);
  const touched = stateId !== "";
  const value = hoodId || cityId || stateId || (initialId ?? "");
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1.5 text-sm font-bold">{label}{required && <span aria-hidden="true"> *</span>}</legend>
      <input type="hidden" name={name} value={value} />
      {initialId && !touched && initialLabel && <p className="text-sm text-ink-muted">Current: <b>{initialLabel}</b>. Choose below to change it.</p>}
      <select className={sel} aria-label="State" required={required && !initialId} value={stateId} onChange={async (e) => { const id = e.target.value; setState(id); setCity(""); setHood(""); setHoods([]); setCities(id ? await children(id) : []); }}>
        <option value="">{initialId && !touched ? "Change state…" : "Select state"}</option>{states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {cities.length > 0 && <select className={sel} aria-label="City" value={cityId} onChange={async (e) => { const id = e.target.value; setCity(id); setHood(""); setHoods(id ? await children(id) : []); }}><option value="">Select city (optional)</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      {hoods.length > 0 && <select className={sel} aria-label="Neighbourhood" value={hoodId} onChange={(e) => setHood(e.target.value)}><option value="">Select neighbourhood (optional)</option>{hoods.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>}
    </fieldset>
  );
}
