import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/marketplace/notice";
import { Filters } from "@/components/marketplace/filters";
import { Pagination } from "@/components/marketplace/pagination";
import { ProfessionalCard } from "@/components/marketplace/professional-card";
import { isSupabaseConfigured } from "@/lib/env";
import { parseDiscoveryParams, toQueryString } from "@/lib/discovery-params";
import { getSessionUser } from "@/server/auth/session";
import { getSelectedLocation } from "@/server/discovery/location";
import { categoryCounts, getSavedIds, listCategories, listLocations, searchProfessionals } from "@/server/discovery/queries";

export const metadata: Metadata = { title: "Explore professionals" };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Explore({ searchParams }: Props) {
  if (!isSupabaseConfigured()) return <Notice title="The marketplace is not connected yet">Add the Supabase environment variables (see docs/SETUP.md).</Notice>;
  const raw = await searchParams;
  try {
    const location = await getSelectedLocation();
    const parsed = parseDiscoveryParams(raw);
    const params = raw.l === undefined && location ? { ...parsed, loc: location.id } : parsed;   // an explicit empty l means "anywhere"
    const [user, categories, states, counts, { rows, total }] = await Promise.all([getSessionUser(), listCategories(), listLocations(null), categoryCounts(), searchProfessionals(params)]);
    const saved = user?.role === "customer" ? await getSavedIds() : new Set<string>();
    const category = categories.find((c) => c.slug === params.category);
    const effective = params.loc ? (location && location.id === params.loc ? location : { id: params.loc, label: "Selected area" }) : null;
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-6 lg:grid-cols-[18rem_1fr]">
        <aside><details className="rounded-card bg-surface p-5 shadow-soft lg:open:block" open><summary className="cursor-pointer text-lg font-extrabold lg:cursor-default">Filters</summary><div className="mt-4"><Filters params={params} categories={categories} states={states} location={effective} action="/explore" /></div></details></aside>
        <section aria-live="polite">
          <h1 className="text-3xl font-extrabold">{category ? category.name : "Explore professionals"}</h1>
          <p className="mt-1 text-sm text-ink-muted">{total === 0 ? "No matches" : `${total} professional${total === 1 ? "" : "s"}`}{params.q ? ` for “${params.q}”` : ""}</p>
          {category && category.subcategories.length > 0 && <ul className="mt-4 flex flex-wrap gap-2">{category.subcategories.map((s) => <li key={s.slug}><Link href={`/explore${toQueryString(params, { sub: params.sub === s.slug ? undefined : s.slug, page: undefined })}`} aria-current={params.sub === s.slug} className={`inline-flex h-9 items-center rounded-control px-4 text-sm font-bold ${params.sub === s.slug ? "bg-forest text-white" : "bg-mint-100 text-forest"}`}>{s.name}</Link></li>)}</ul>}
          <div className="mt-6 space-y-4">
            {rows.map((p) => <ProfessionalCard key={p.id} p={p} user={user} saved={saved.has(p.id)} />)}
            {rows.length === 0 && (
              <Notice title="No professionals match these filters" action={{ href: "/explore?l=", label: "Clear all filters" }}>
                Try a broader search, remove a filter, or browse a service:
                <span className="mt-3 flex flex-wrap justify-center gap-2">{categories.slice(0, 6).map((c) => <Link key={c.id} href={`/explore?category=${c.slug}&l=`} className="rounded-control bg-surface px-3 py-1.5 font-bold text-forest ring-1 ring-line">{c.name}{counts[c.slug] ? ` (${counts[c.slug]})` : ""}</Link>)}</span>
              </Notice>)}
          </div>
          <Pagination params={params} total={total} basePath="/explore" />
        </section>
      </div>
    );
  } catch {
    return <Notice title="We could not load professionals" action={{ href: "/explore", label: "Try again" }}>Please try again in a moment.</Notice>;
  }
}
