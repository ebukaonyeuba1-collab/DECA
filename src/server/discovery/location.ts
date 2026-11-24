import "server-only";
import { cookies } from "next/headers";
import { LOCATION_COOKIE, RECENT_COOKIE, parseLocationCookie, parseRecentCookie, type SelectedLocation } from "@/lib/cookie-state";

export async function getSelectedLocation(): Promise<SelectedLocation | null> {
  return parseLocationCookie((await cookies()).get(LOCATION_COOKIE)?.value);
}
export async function getRecentSlugs(): Promise<string[]> {
  return parseRecentCookie((await cookies()).get(RECENT_COOKIE)?.value);
}
