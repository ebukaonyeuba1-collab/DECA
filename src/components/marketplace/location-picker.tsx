"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { LOCATION_COOKIE, type SelectedLocation } from "@/lib/cookie-state";
import type { LocationOption } from "@/server/discovery/types";
import { Button } from "@/components/ui/button";

type Props = { states: LocationOption[]; current: SelectedLocation | null; variant: "header" | "field" };
const sel = "h-11 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base";

async function children(parent: string): Promise<LocationOption[]> {
  try { const r = await fetch(`/api/locations?parent=${parent}`); return r.ok ? (await r.json()).locations : []; } catch { return []; }
}

export function LocationPicker({ states, current, variant }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [stateId, setState] = useState(""); const [cityId, setCity] = useState(""); const [hoodId, setHood] = useState("");
  const [cities, setCities] = useState<LocationOption[]>([]); const [hoods, setHoods] = useState<LocationOption[]>([]);
  const name = (list: LocationOption[], id: string) => list.find((l) => l.id === id)?.name;
  const deepest = hoodId || cityId || stateId || current?.id || "";
  const label = [name(hoods, hoodId), name(cities, cityId), name(states, stateId)].filter(Boolean).slice(0, 2).join(", ");

  async function pickState(id: string) { setState(id); setCity(""); setHood(""); setHoods([]); setCities(id ? await children(id) : []); }
  async function pickCity(id: string) { setCity(id); setHood(""); setHoods(id ? await children(id) : []); }
  function apply() {
    if (!deepest) return;
    const value = encodeURIComponent(JSON.stringify({ id: deepest, label: label || current?.label || "Selected area" }));
    document.cookie = `${LOCATION_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
    dialog.current?.close(); router.refresh();
  }
  function clear() { document.cookie = `${LOCATION_COOKIE}=; path=/; max-age=0`; setState(""); setCity(""); setHood(""); dialog.current?.close(); router.refresh(); }

  const fields = (
    <div className="space-y-3">
      <select className={sel} aria-label="State" value={stateId} onChange={(e) => pickState(e.target.value)}><option value="">{current && !stateId ? `Keep: ${current.label}` : "Any state"}</option>{states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      {cities.length > 0 && <select className={sel} aria-label="City" value={cityId} onChange={(e) => pickCity(e.target.value)}><option value="">Any city in {name(states, stateId)}</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      {hoods.length > 0 && <select className={sel} aria-label="Neighbourhood" value={hoodId} onChange={(e) => setHood(e.target.value)}><option value="">Any neighbourhood</option>{hoods.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>}
    </div>
  );

  if (variant === "field") return <div><input type="hidden" name="l" value={stateId === "" && !current ? "" : deepest} />{fields}{current && !stateId && <p className="mt-1 text-xs text-ink-muted">Showing {current.label}</p>}</div>;
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex h-10 items-center gap-1.5 rounded-control bg-mint-100 px-3 text-sm font-bold text-forest" aria-haspopup="dialog">
        <MapPin className="h-4 w-4" aria-hidden="true" /><span className="max-w-[9rem] truncate">{current?.label ?? "Choose location"}</span>
      </button>
      <dialog ref={dialog} className="w-[min(92vw,26rem)] rounded-sheet p-6 backdrop:bg-black/40" aria-label="Choose your location">
        <h2 className="text-xl font-extrabold">Where do you need help?</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">We will show professionals who serve this area.</p>
        {fields}
        <div className="mt-6 flex gap-3"><Button onClick={apply} disabled={!deepest} className="flex-1">Use this location</Button><Button variant="secondary" onClick={clear}>Clear</Button></div>
        <button type="button" onClick={() => dialog.current?.close()} className="mt-3 w-full text-sm font-bold text-ink-muted">Cancel</button>
      </dialog>
    </>
  );
}
