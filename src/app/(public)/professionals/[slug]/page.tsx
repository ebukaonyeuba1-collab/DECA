import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin } from "lucide-react";
import { Avatar } from "@/components/marketplace/avatar";
import { Notice } from "@/components/marketplace/notice";
import { Rating } from "@/components/marketplace/rating";
import { RecordView } from "@/components/marketplace/record-view";
import { SaveButton } from "@/components/marketplace/save-button";
import { VerificationBadges } from "@/components/marketplace/verification-badges";
import { isSupabaseConfigured } from "@/lib/env";
import { publicMediaUrl } from "@/lib/media";
import { priceLabel } from "@/lib/pricing";
import { getSessionUser } from "@/server/auth/session";
import { getProfessionalBySlug, getProfessionalDetail, getSavedIds } from "@/server/discovery/queries";

type Props = { params: Promise<{ slug: string }> };
const slugOk = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 80;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (t: string) => t.slice(0, 5);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isSupabaseConfigured() || !slugOk(slug)) return { title: "Professional" };
  const p = await getProfessionalBySlug(slug).catch(() => null);
  if (!p) return { title: "Professional not found" };
  const description = p.headline ?? p.bio?.slice(0, 150) ?? `${p.display_name} on DECA`;
  return { title: `${p.display_name}${p.primary_category_name ? `, ${p.primary_category_name}` : ""}`, description, openGraph: { title: p.display_name, description, type: "profile" } };
}

export default async function ProfessionalPage({ params }: Props) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return <Notice title="The marketplace is not connected yet" />;
  if (!slugOk(slug)) notFound();
  let data;
  try {
    const p = await getProfessionalBySlug(slug);
    if (!p) notFound();
    const [detail, user] = await Promise.all([getProfessionalDetail(p.id), getSessionUser()]);
    const saved = user?.role === "customer" ? (await getSavedIds()).has(p.id) : false;
    data = { p, detail, user, saved };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;   // let notFound() through
    return <Notice title="We could not load this profile" action={{ href: `/professionals/${slug}`, label: "Try again" }}>Please try again in a moment.</Notice>;
  }
  const { p, detail, user, saved } = data;
  const next = encodeURIComponent(`/professionals/${p.slug}`);
  const byDay = DAYS.map((d, i) => ({ d, slots: detail.availability.filter((a) => a.weekday === i) })).filter((x) => x.slots.length);
  const customerOrGuest = !user || user.role === "customer";
  const primary = "inline-flex h-12 items-center justify-center rounded-control px-6 font-bold";

  return (
    <article className="mx-auto max-w-6xl px-4 pt-6">
      <RecordView slug={p.slug} />
      <header className="grid gap-6 rounded-sheet bg-gradient-to-br from-forest to-forest-700 p-6 text-white md:grid-cols-[auto_1fr_auto] md:items-center md:p-10">
        <Avatar name={p.display_name} path={p.avatar_path} className="h-24 w-24 text-3xl ring-4 ring-mint/40 md:h-32 md:w-32" />
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">{p.display_name}</h1>
          <p className="mt-1 text-mint">{p.primary_category_name}{p.business_name ? ` · ${p.business_name}` : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-white [&_*]:text-inherit">
            <Rating avg={p.rating_avg} count={p.review_count} />
            {p.years_experience != null && <span className="text-sm">{p.years_experience} years experience</span>}
            {p.review_count > 0 || p.completed_jobs > 0 ? <span className="text-sm">{p.completed_jobs} completed on DECA</span> : null}
          </div>
          <div className="mt-3"><VerificationBadges identity={p.identity_verified} credentials={p.credentials_verified} experience={p.experience_verified} /></div>
          {p.is_sponsored && <p className="mt-3 text-xs font-bold uppercase tracking-wide text-mint">Sponsored listing</p>}
        </div>
        <div className="flex flex-col gap-3 md:w-56">
          {customerOrGuest && (user
            ? <><span aria-disabled="true" className={`${primary} cursor-not-allowed bg-white/30 text-white`}>Contact Professional</span><span aria-disabled="true" className={`${primary} cursor-not-allowed bg-white/15 text-white`}>Request Service</span><p className="text-xs text-mint">Messaging and service requests are coming soon.</p></>
            : <><Link href={`/login?next=${next}`} className={`${primary} bg-white text-forest`}>Contact Professional</Link><Link href={`/login?next=${next}`} className={`${primary} bg-mint/25 text-white ring-2 ring-inset ring-white/60`}>Request Service</Link></>)}
          <div className="self-start"><SaveButton professionalId={p.id} slug={p.slug} saved={saved} user={user} /></div>
        </div>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-12">
          {p.bio && <section aria-labelledby="about"><h2 id="about" className="text-2xl font-extrabold">About</h2><p className="mt-3 whitespace-pre-line leading-relaxed">{p.bio}</p></section>}

          <section aria-labelledby="services"><h2 id="services" className="text-2xl font-extrabold">Services and pricing</h2>
            {detail.services.length === 0 ? <p className="mt-3 text-ink-muted">No services listed yet.</p> :
              <ul className="mt-4 divide-y divide-line">{detail.services.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:justify-between sm:gap-6">
                  <div><h3 className="font-extrabold">{s.name}</h3><p className="text-sm text-ink-muted">{s.category_name}{s.subcategory_name ? ` · ${s.subcategory_name}` : ""}{s.duration_minutes ? ` · about ${s.duration_minutes} min` : ""}</p>
                    {s.description && <p className="mt-1 text-sm">{s.description}</p>}
                    {s.inclusions && <p className="mt-1 text-sm"><b>Includes:</b> {s.inclusions}</p>}{s.exclusions && <p className="text-sm"><b>Excludes:</b> {s.exclusions}</p>}
                    {s.additional_charges && <p className="text-sm text-ink-muted">Additional charges: {s.additional_charges}</p>}</div>
                  <p className="shrink-0 font-bold text-forest">{priceLabel(s.pricing_type, s.price_minor, s.currency)}{s.minimum_charge_minor ? <span className="block text-xs font-medium text-ink-muted">Minimum {priceLabel("fixed", s.minimum_charge_minor, s.currency)}</span> : null}</p>
                </li>))}</ul>}
            <p className="mt-3 text-xs text-ink-muted">Prices are indicative. The final amount is agreed in a quotation.</p></section>

          <section aria-labelledby="portfolio"><h2 id="portfolio" className="text-2xl font-extrabold">Portfolio</h2>
            {detail.portfolio.length === 0 ? <p className="mt-3 text-ink-muted">No work samples yet.</p> :
              <div className="mt-4 space-y-8">{detail.portfolio.map((item) => (
                <figure key={item.id}><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{item.media.map((m, i) => { const url = publicMediaUrl(m.path); if (!url) return null; return (
                  <div key={i} className="relative overflow-hidden rounded-card bg-mint-100">
                    {m.type === "video" ? <video src={url} controls preload="none" className="aspect-[4/3] w-full object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={`${item.title}${m.kind !== "work" ? ` (${m.kind})` : ""}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
                    {m.kind !== "work" && <span className="absolute left-2 top-2 rounded-control bg-forest-900/80 px-2 py-0.5 text-xs font-bold capitalize text-white">{m.kind}</span>}
                  </div>); })}</div>
                  <figcaption className="mt-2"><b>{item.title}</b>{item.completed_on ? <span className="text-sm text-ink-muted"> · {new Date(item.completed_on).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}</span> : null}{item.description && <p className="text-sm text-ink-muted">{item.description}</p>}</figcaption></figure>))}</div>}</section>

          <section aria-labelledby="reviews"><h2 id="reviews" className="text-2xl font-extrabold">Reviews</h2>
            {detail.reviews.length === 0 ? <p className="mt-3 text-ink-muted">No reviews yet. Reviews on DECA come only from customers whose job was completed through DECA.</p> :
              <ul className="mt-4 space-y-6">{detail.reviews.map((r) => (
                <li key={r.id} className="border-l-4 border-mint pl-4">
                  <div className="flex flex-wrap items-center gap-3"><Rating avg={r.rating_overall} count={1} /><b>{r.reviewer_name}</b><time className="text-sm text-ink-muted" dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}</time></div>
                  {r.body && <p className="mt-1">{r.body}</p>}
                  {r.response_body && <p className="mt-2 rounded-2xl bg-mint-50 p-3 text-sm"><b>Response from {p.display_name}:</b> {r.response_body}</p>}
                </li>))}</ul>}</section>
        </div>

        <aside className="space-y-10 lg:pt-1">
          <section aria-labelledby="areas"><h2 id="areas" className="text-xl font-extrabold">Service areas</h2>
            {detail.coverage.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Not specified.</p> : <ul className="mt-3 space-y-2 text-sm">{detail.coverage.map((c) => (
              <li key={c.location_id} className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-700" aria-hidden="true" /><span>{[c.neighbourhood_name, c.city_name, c.state_name].filter(Boolean).join(", ") || c.location_name}{c.travel_available ? <span className="block text-xs text-ink-muted">Travels to you</span> : null}{c.remote_available ? <span className="block text-xs text-ink-muted">Remote service available</span> : null}</span></li>))}</ul>}</section>
          <section aria-labelledby="hours"><h2 id="hours" className="text-xl font-extrabold">Availability</h2>
            {byDay.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Ask for availability when you enquire.</p> : <dl className="mt-3 space-y-1.5 text-sm">{byDay.map(({ d, slots }) => <div key={d} className="flex justify-between gap-3"><dt className="inline-flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-forest-700" aria-hidden="true" />{d}</dt><dd>{slots.map((s) => `${hhmm(s.start_time)} to ${hhmm(s.end_time)}`).join(", ")}</dd></div>)}</dl>}</section>
          <p className="text-xs text-ink-muted">Verification badges show only what DECA reviewers have individually accepted. Contact details stay private; all messages go through DECA.</p>
        </aside>
      </div>
    </article>
  );
}
