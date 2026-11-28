import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/status-badge";
import { describeEvent } from "@/lib/admin-verification";
import type { VerificationStatus } from "@/lib/domain";
import { publicMediaUrl } from "@/lib/media";
import { POLICY_TITLES, isPolicyKey } from "@/lib/policies";
import { priceLabel, type PricingType } from "@/lib/pricing";
import type { ApplicationDetail } from "@/server/admin/queries";
import { ActionForm } from "@/components/onboarding/action-form";
import { AdminDocButton } from "@/components/onboarding/admin-doc-button";
import { reviewDocumentAction } from "@/server/admin/verification";

const inp = "h-11 w-full rounded-xl border-2 border-line bg-surface px-3";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "");
const Section = ({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) => (
  <section aria-labelledby={id} className="rounded-card bg-surface p-5 shadow-soft md:p-6"><h2 id={id} className="text-xl font-extrabold">{title}</h2>{note && <p className="mt-1 text-xs font-semibold text-ink-muted">{note}</p>}<div className="mt-4">{children}</div></section>
);
const Field = ({ k, v }: { k: string; v: React.ReactNode }) => v ? <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr]"><dt className="text-sm font-bold text-ink-muted">{k}</dt><dd className="break-words">{v}</dd></div> : null;

export function DecisionBanner({ d }: { d: ApplicationDetail }) {
  if (!["rejected", "suspended", "approved", "additional_information_required"].includes(d.app.status)) return null;
  const who = d.app.reviewed_by ? d.adminNames.get(d.app.reviewed_by) ?? "an administrator" : null;
  const tone = d.app.status === "approved" ? "bg-success/10" : d.app.status === "additional_information_required" ? "bg-warning/10" : "bg-danger/10";
  return (
    <div role="status" className={`rounded-card p-5 ${tone}`}>
      <p className="font-extrabold">Current decision: <VerificationBadge status={d.app.status as VerificationStatus} /></p>
      {d.app.decision_reason && <p className="mt-2"><b>Reason:</b> {d.app.decision_reason}</p>}
      <p className="mt-1 text-sm text-ink-muted">{who ? `By ${who}` : ""}{d.app.reviewed_at ? ` on ${when(d.app.reviewed_at)}` : ""}</p>
      {d.app.status === "rejected" && <p className="mt-2 text-sm">This record stays on file. To let the professional try again, record the decision “Request more information”.</p>}
    </div>
  );
}

export function ProfileSection({ d }: { d: ApplicationDetail }) {
  const p = d.pro; const c = d.profile;
  return (
    <Section id="profile" title="Professional profile">
      <dl className="space-y-3">
        <Field k="Name shown to customers" v={p.display_name} /><Field k="Account type" v={<span className="capitalize">{p.account_type}</span>} /><Field k="Headline" v={p.headline} />
        <Field k="Main category" v={p.primary_category_id ? d.categoryNames.get(p.primary_category_id) : null} /><Field k="Experience" v={p.years_experience != null ? `${p.years_experience} years` : null} />
        <Field k="About" v={p.bio ? <span className="whitespace-pre-line">{p.bio}</span> : null} />
        <Field k="Public profile" v={p.is_listed ? <Link className="font-bold text-forest underline" href={`/professionals/${p.slug}`}>/professionals/{p.slug}</Link> : <span className="text-ink-muted">Not listed publicly</span>} />
        <Field k="Registered" v={when(p.created_at)} />
      </dl>
      <h3 className="mb-1 mt-6 font-extrabold">Contact details</h3><p className="mb-3 text-xs font-semibold text-ink-muted">Private. Visible to administrators only, never shown publicly.</p>
      <dl className="space-y-3"><Field k="Legal name" v={c?.full_name} /><Field k="Email" v={c?.email} /><Field k="Phone" v={c?.phone ? `${c.phone}${c.phone_verified_at ? " (verified)" : " (not verified)"}` : null} /><Field k="Based in" v={d.locationLabel} /></dl>
    </Section>
  );
}

export function BusinessSection({ d }: { d: ApplicationDetail }) {
  if (d.pro.account_type !== "business") return null;
  const b = d.business;
  return (
    <Section id="business" title="Business information" note="Only the registered name is public.">
      {!b ? <p className="text-ink-muted">No business details submitted.</p> : <dl className="space-y-3">
        <Field k="Registered name" v={b.registered_name} /><Field k="Registration number" v={b.registration_number} /><Field k="Established" v={b.year_established} /><Field k="Business email" v={b.email} /><Field k="Business phone" v={b.phone} />
        <Field k="Website" v={b.website ? <a href={String(b.website)} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-forest underline">{String(b.website)}</a> : null} /><Field k="Address" v={b.address_line} /><Field k="Description" v={b.description} /></dl>}
    </Section>
  );
}

export function ServicesSection({ d }: { d: ApplicationDetail }) {
  return (
    <Section id="services" title="Services and pricing" note="Prices are indicative; final amounts are agreed in quotations.">
      {d.services.length === 0 ? <p className="text-ink-muted">No services added.</p> : <ul className="divide-y divide-line">{d.services.map((s) => (
        <li key={s.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-6">
          <div><p className="font-extrabold">{s.name} {s.deleted_at && <Badge tone="neutral">Removed</Badge>}</p><p className="text-sm text-ink-muted">{d.categoryNames.get(s.category_id)}{s.duration_minutes ? ` · about ${s.duration_minutes} min` : ""}</p>{s.description && <p className="text-sm">{s.description}</p>}{s.additional_charges && <p className="text-sm text-ink-muted">Additional charges: {s.additional_charges}</p>}</div>
          <p className="shrink-0 font-bold text-forest">{priceLabel(s.pricing_type as PricingType, s.price_minor)}{s.minimum_charge_minor ? <span className="block text-xs font-medium text-ink-muted">Minimum {priceLabel("fixed", s.minimum_charge_minor)}</span> : null}</p>
        </li>))}</ul>}
      <h3 className="mb-2 mt-6 font-extrabold">Service areas</h3>
      {d.coverage.length === 0 ? <p className="text-ink-muted">None added.</p> : <ul className="flex flex-wrap gap-2">{d.coverage.map((c) => <li key={c.id}><Badge>{c.locations?.name}{c.travel_available ? " · travels" : ""}{c.remote_available ? " · remote" : ""}</Badge></li>)}</ul>}
      {d.portfolio.length > 0 && <><h3 className="mb-2 mt-6 font-extrabold">Portfolio</h3><ul className="space-y-4">{d.portfolio.map((i) => <li key={i.id}><p className="font-bold">{i.title}</p><div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">{i.portfolio_media.map((m) => { const u = publicMediaUrl(m.storage_path); return u ? /* eslint-disable-next-line @next/next/no-img-element */ <img key={m.id} src={u} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" /> : null; })}</div></li>)}</ul></>}
    </Section>
  );
}

export function DocumentsSection({ d }: { d: ApplicationDetail }) {
  const reqName = new Map(d.reqs.map((r) => [r.id, r]));
  return (
    <Section id="docs" title="Submitted documents" note="Files open through links that expire after 60 seconds. They are never public. Removed documents stay on record.">
      {d.docs.length === 0 ? <p className="text-ink-muted">No documents uploaded.</p> : <ul className="space-y-4">{d.docs.map((x) => { const r = x.requirement_id ? reqName.get(x.requirement_id) : null; const by = x.reviewed_by ? d.adminNames.get(x.reviewed_by) : null; return (
        <li key={x.id} className={`rounded-2xl p-4 ring-1 ring-line ${x.deleted_at ? "bg-ink/5" : "bg-mint-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-extrabold">{r?.name ?? "Other supporting document"} {r && <Badge tone={r.is_required ? "warning" : "neutral"}>{r.is_required ? "Required" : "Optional"}</Badge>} {x.deleted_at && <Badge tone="neutral">Removed by professional {when(x.deleted_at)}</Badge>}</p>
              <p className="text-sm text-ink-muted">{x.file_name} · {x.mime_type}{x.size_bytes ? ` · ${Math.round(x.size_bytes / 1024)} KB` : ""} · uploaded {when(x.uploaded_at ?? x.created_at)}</p></div>
            <span className="flex items-center gap-3 text-sm">{x.uploaded_at ? <AdminDocButton documentId={x.id} /> : <Badge tone="warning">Upload unfinished</Badge>}<Badge tone={x.review_status === "accepted" ? "success" : x.review_status === "rejected" ? "danger" : "neutral"}>{x.review_status}</Badge></span></div>
          {x.reviewed_at && <p className="mt-2 text-xs text-ink-muted">Reviewed by {by ?? "an administrator"} on {when(x.reviewed_at)}{x.review_note ? `. Note: ${x.review_note}` : ""}</p>}
          {x.uploaded_at && !x.deleted_at && <ActionForm action={reviewDocumentAction} submitLabel="Save decision" secondary className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"><input type="hidden" name="id" value={x.id} />
            <div><label className="mb-1 block text-sm font-bold" htmlFor={`s${x.id}`}>Decision</label><select id={`s${x.id}`} name="status" defaultValue={x.review_status} className={inp}><option value="accepted">Accept</option><option value="rejected">Reject</option><option value="pending">Pending</option></select></div>
            <div><label className="mb-1 block text-sm font-bold" htmlFor={`n${x.id}`}>Note to professional (required to reject)</label><input id={`n${x.id}`} name="note" defaultValue={x.review_note ?? ""} className={inp} maxLength={500} /></div></ActionForm>}
        </li>); })}</ul>}
    </Section>
  );
}

export function HistorySection({ d }: { d: ApplicationDetail }) {
  return (
    <Section id="history" title="Verification history" note="Every decision is kept: who decided, what, why and when. Records are never deleted.">
      {d.events.length === 0 ? <p className="text-ink-muted">No history yet.</p> : <ol className="space-y-4 border-l-2 border-mint pl-5">{d.events.map((e) => { const x = describeEvent(e); return (
        <li key={e.id} className="relative"><span aria-hidden="true" className="absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full bg-forest" />
          <p className="font-extrabold">{x.title}</p>{x.detail && <p className="text-sm">{x.detail}</p>}
          <p className="text-xs text-ink-muted"><time dateTime={e.created_at}>{when(e.created_at)}</time>{e.actor_id ? ` · by ${d.adminNames.get(e.actor_id) ?? "the professional"}` : ""}{e.actor_id ? ` (ID ${e.actor_id.slice(0, 8)})` : ""}</p></li>); })}</ol>}
      <h3 className="mb-2 mt-6 font-extrabold">Policies accepted</h3>
      {d.accepted.length === 0 ? <p className="text-sm text-ink-muted">None recorded.</p> : <ul className="flex flex-wrap gap-2">{d.accepted.map((a) => <li key={a.policy_key + a.version}><Badge tone={a.version === d.currentPolicyVersion ? "success" : "warning"}>{isPolicyKey(a.policy_key) ? POLICY_TITLES[a.policy_key] : a.policy_key} · v{a.version}</Badge></li>)}</ul>}
    </Section>
  );
}
