/** URL slug for a public profile. Matches the database check: lowercase letters, digits and single hyphens. */
export function slugify(input: string): string {
  const s = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return s || "professional";
}
export function withSuffix(slug: string, n: number): string {
  const suffix = Math.random().toString(36).slice(2, 2 + Math.min(3 + n, 6));
  return `${slug.slice(0, 60)}-${suffix}`.replace(/-+/g, "-");
}
