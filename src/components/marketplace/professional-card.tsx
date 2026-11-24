import Link from "next/link";
import { MapPin } from "lucide-react";
import { priceLabel } from "@/lib/pricing";
import type { ProfessionalCardData } from "@/server/discovery/types";
import type { SessionUser } from "@/server/auth/session";
import { Avatar } from "./avatar";
import { Rating } from "./rating";
import { SaveButton } from "./save-button";
import { VerificationBadges } from "./verification-badges";

export function ProfessionalCard({ p, user, saved }: { p: ProfessionalCardData; user: SessionUser | null; saved: boolean }) {
  const name = p.business_name ?? p.display_name;
  return (
    <article className="group relative flex gap-4 rounded-card bg-surface p-4 shadow-soft transition-shadow duration-200 ease-deca hover:shadow-lift">
      <Avatar name={p.display_name} path={p.avatar_path} className="h-16 w-16 shrink-0 text-lg" />
      <div className="min-w-0 flex-1">
        {p.is_sponsored && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-warning">Sponsored</p>}
        <h3 className="truncate text-lg font-extrabold">
          <Link href={`/professionals/${p.slug}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:after:outline focus-visible:after:outline-2">{p.display_name}</Link>
        </h3>
        <p className="text-sm text-ink-muted">{p.primary_category_name}{p.business_name && p.business_name !== p.display_name ? ` · ${name}` : ""}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Rating avg={p.rating_avg} count={p.review_count} />
          {p.location_label && <span className="inline-flex items-center gap-1 text-sm text-ink-muted"><MapPin className="h-4 w-4" aria-hidden="true" />{p.location_label}</span>}
          {p.years_experience != null && <span className="text-sm text-ink-muted">{p.years_experience} yrs experience</span>}
        </div>
        {p.summary && <p className="mt-2 line-clamp-2 text-sm">{p.summary}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <VerificationBadges identity={p.identity_verified} credentials={p.credentials_verified} experience={p.experience_verified} />
          <p className="text-sm font-bold text-forest">{priceLabel(p.pricing_type, p.starting_price_minor, p.currency ?? "NGN")}</p>
        </div>
      </div>
      <div className="relative z-10 self-start"><SaveButton professionalId={p.id} slug={p.slug} saved={saved} user={user} /></div>
    </article>
  );
}
