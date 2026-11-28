import Link from "next/link";

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return <header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-extrabold">{title}</h1>{sub && <p className="mt-1 max-w-2xl text-ink-muted">{sub}</p>}</div>{children}</header>;
}
export function Metric({ label, value, href, hint }: { label: string; value: React.ReactNode; href?: string; hint?: string }) {
  const body = <><p className="text-sm font-bold text-ink-muted">{label}</p><p className="mt-1 text-3xl font-extrabold text-forest">{value}</p>{hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}</>;
  return href ? <Link href={href} className="block rounded-card bg-surface p-5 shadow-soft transition-shadow hover:shadow-lift">{body}</Link> : <div className="rounded-card bg-surface p-5 shadow-soft">{body}</div>;
}
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "");
