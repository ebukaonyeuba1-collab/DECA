import Link from "next/link";
import { ArrowRight, MessagesSquare, ShieldCheck, Images } from "lucide-react";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { Notice } from "@/components/marketplace/notice";
import { ProfessionalCard } from "@/components/marketplace/professional-card";
import { SearchBar } from "@/components/marketplace/search-bar";
import { isSupabaseConfigured } from "@/lib/env";
import { parseDiscoveryParams } from "@/lib/discovery-params";
import { getSessionUser } from "@/server/auth/session";
import { getRecentSlugs, getSelectedLocation } from "@/server/discovery/location";
import { categoryCounts, getProfessionalsBySlugs, getSavedIds, listCategories, searchProfessionals } from "@/server/discovery/queries";

export default async function Home() {
  if (!isSupabaseConfigured()) return <Notice title="The marketplace is not connected yet">Add the Supabase environment variables (see docs/SETUP.md) to load professionals.</Notice>;
  try {
    const [user, location, recentSlugs, categories, counts] = await Promise.all([getSessionUser(), getSelectedLocation(), getRecentSlugs(), listCategories(), categoryCounts()]);
    const base = parseDiscoveryParams({});
    const top = await searchProfessionals({ ...base, sort: "rating" });
    const rated = top.rows.filter((p) => p.review_count > 0).slice(0, 4);
    const newest = rated.length === 0 ? (await searchProfessionals({ ...base, sort: "newest" })).rows.slice(0, 4) : [];
    const near = location ? (await searchProfessionals({ ...base, loc: location.id })).rows.slice(0, 4) : [];
    const recent = await getProfessionalsBySlugs(recentSlugs);
    const saved = user?.role === "customer" ? await getSavedIds() : new Set<string>();
    const section = (title: string, sub: string, rows: typeof rated, href?: string) => rows.length === 0 ? null : (
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="flex items-end justify-between"><div><h2 className="text-2xl font-extrabold">{title}</h2><p className="text-sm text-ink-muted">{sub}</p></div>{href && <Link href={href} className="text-sm font-bold text-forest-700">View all</Link>}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{rows.map((p) => <ProfessionalCard key={p.id} p={p} user={user} saved={saved.has(p.id)} />)}</div>
      </section>);
    return (
      <>
        <section className="mx-auto max-w-6xl px-4 pt-4">
          <div className="relative overflow-hidden rounded-sheet bg-forest p-7 text-white md:p-14">
            <div aria-hidden="true" className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-forest-700/60" /><div aria-hidden="true" className="absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-mint/20" />
            <div className="relative max-w-xl">
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">Good work starts with the right connection.</h1>
              <p className="mb-7 mt-4 text-lg text-mint">Find trusted professionals for everyday jobs, compare their work and message them through DECA.</p>
              <SearchBar large />
              <Link href="/explore" className="mt-5 inline-flex items-center gap-2 font-bold text-white underline-offset-4 hover:underline">Explore services <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
          </div>
        </section>
        <section className="mx-auto mt-12 max-w-6xl px-4" aria-labelledby="cats">
          <h2 id="cats" className="text-2xl font-extrabold">Browse by service</h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, 12).map((c) => (
              <li key={c.id}><Link href={`/categories/${c.slug}`} className="flex h-full flex-col gap-3 rounded-card bg-surface p-4 shadow-soft transition-colors duration-200 hover:bg-mint-100">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-forest"><CategoryIcon name={c.icon} className="h-6 w-6" /></span>
                <span className="font-bold leading-tight">{c.name}</span>
                <span className="text-xs text-ink-muted">{counts[c.slug] ? `${counts[c.slug]} professional${counts[c.slug] === 1 ? "" : "s"}` : "None listed yet"}</span>
              </Link></li>))}
          </ul>
        </section>
        {section(rated.length ? "Top rated" : "Newly listed", rated.length ? "Ranked by reviews from completed jobs." : "No reviews yet. These professionals have just joined DECA.", rated.length ? rated : newest, "/explore?sort=rating")}
        {section(`Near ${location?.label ?? "you"}`, "Professionals who serve your selected area.", near, location ? `/explore?l=${location.id}` : undefined)}
        {section("Recently viewed", "Pick up where you left off.", recent)}
        {rated.length === 0 && newest.length === 0 && <section className="mx-auto mt-14 max-w-6xl px-4"><Notice title="No professionals are listed yet" action={{ href: "/register", label: "Join as a professional" }}>Professionals appear here once DECA has reviewed and approved them.</Notice></section>}
        <section className="mx-auto mt-16 max-w-6xl px-4" aria-labelledby="how">
          <h2 id="how" className="text-2xl font-extrabold">How DECA works</h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3">
            {[[Images, "Discover", "Browse profiles, portfolios and reviews. No account needed."], [ShieldCheck, "Check", "See what DECA reviewers have verified: identity, credentials and experience, shown separately."], [MessagesSquare, "Connect", "Message professionals inside DECA. Your phone number stays private."]].map(([Icon, t, d], i) => { const I = Icon as typeof Images; return <li key={i} className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest text-white"><I className="h-6 w-6" aria-hidden="true" /></span><div><h3 className="font-extrabold">{t as string}</h3><p className="text-sm text-ink-muted">{d as string}</p></div></li>; })}
          </ol>
        </section>
        <section className="mx-auto mt-16 max-w-6xl px-4"><div className="flex flex-col items-start justify-between gap-4 rounded-sheet bg-mint p-8 md:flex-row md:items-center"><div><h2 className="text-2xl font-extrabold text-forest">Grow your business on DECA</h2><p className="text-forest/80">Build a verified profile, show your work and receive enquiries.</p></div><Link href="/register" className="inline-flex h-12 items-center rounded-control bg-forest px-6 font-bold text-white">Join as a professional</Link></div></section>
      </>
    );
  } catch {
    return <Notice title="We could not load professionals" action={{ href: "/", label: "Try again" }}>Please try again in a moment.</Notice>;
  }
}
