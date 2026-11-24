"use client";
import { useEffect } from "react";
import { RECENT_COOKIE, addRecent, parseRecentCookie } from "@/lib/cookie-state";

/** Remembers the last few professionals viewed (cookie, slugs only, no personal data). */
export function RecordView({ slug }: { slug: string }) {
  useEffect(() => {
    const current = document.cookie.split("; ").find((c) => c.startsWith(`${RECENT_COOKIE}=`))?.split("=")[1];
    const next = addRecent(parseRecentCookie(current), slug);
    document.cookie = `${RECENT_COOKIE}=${encodeURIComponent(next.join(","))}; path=/; max-age=2592000; SameSite=Lax`;
  }, [slug]);
  return null;
}
