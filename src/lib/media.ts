/** Public media (avatars, logos, portfolio) lives in the public-media bucket. Evidence documents never do. */
export function publicMediaUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  const safe = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/public-media/${safe}`;
}
export function initials(name: string): string {
  return name.replace(/\[DEMO\]/i, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "D";
}
