import { z } from "zod";

export const LOCATION_COOKIE = "deca_location";
export const RECENT_COOKIE = "deca_recent";
export type SelectedLocation = { id: string; label: string };

const locSchema = z.object({ id: z.string().uuid(), label: z.string().min(1).max(80) });
/** Cookies are user-controlled input: validate before use. */
export function parseLocationCookie(value: string | undefined): SelectedLocation | null {
  if (!value) return null;
  try { const r = locSchema.safeParse(JSON.parse(decodeURIComponent(value))); return r.success ? r.data : null; } catch { return null; }
}
const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function parseRecentCookie(value: string | undefined): string[] {
  if (!value) return [];
  return decodeURIComponent(value).split(",").filter((s) => s.length <= 80 && slugRe.test(s)).slice(0, 6);
}
export function addRecent(list: string[], slug: string): string[] {
  return [slug, ...list.filter((s) => s !== slug)].slice(0, 6);
}
