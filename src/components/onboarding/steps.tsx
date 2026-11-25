import Link from "next/link";
import { Avatar } from "@/components/marketplace/avatar";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/status-badge";
import { publicMediaUrl } from "@/lib/media";
import { priceLabel, type PricingType } from "@/lib/pricing";
import { POLICY_TITLES, isPolicyKey } from "@/lib/policies";
import type { VerificationStatus } from "@/lib/domain";
import { readyToSubmit } from "@/lib/onboarding-steps";
import type { OnboardingData } from "@/server/onboarding/queries";
import type { CategoryRow, LocationOption } from "@/server/discovery/types";
import { acceptAndSubmit, addCoverage, addDayOff, addService, createPortfolioItem, removeCoverage, removeDayOff, removeDocument, removePortfolioItem, removeService, saveAvailability, saveBusiness, saveProfessionalProfile } from "@/server/onboarding/actions";
import { ActionForm } from "./action-form";
import { LocationSelect } from "./location-select";
import { ServiceFields } from "./service-fields";
import { DocumentUploader, PublicImageUpload, ViewDocumentButton } from "./uploaders";

const inp = "h-12 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base";
const lab = "mb-1.5 block text-sm font-bold";
const H = ({ children, sub }: { children: React.ReactNode; sub?: string }) => <header className="mb-6"><h2 className="text-2xl font-extrabold">{children}</h2>{sub && <p className="mt-1 text-ink-muted">{sub}</p>}</header>;
const Next = ({ to, label = "Continue" }: { to: string; label?: string }) => <Link href={to} className="inline-flex h-12 items-center rounded-control bg-forest px-6 font-bold text-white hover:bg-forest-700">{label}</Link>;
const Remove = ({ action, id, label }: { action: Parameters<typeof ActionForm>[0]["action"]; id: string; label: string }) => <ActionForm action={action} submitLabel="Remove" secondary className="inline-flex flex-col items-end gap-1"><input type="hidden" name="id" value={id} /><span className="sr-only">{label}</span></ActionForm>;
const EDITABLE = ["not_started", "incomplete", "additional_information_required"];

export function ProfileStep({ d, categories, states, userId, businessBanner }: { d: OnboardingData; categories: CategoryRow[]; states: LocationOption[]; userId: string; businessBanner: boolean }) {
  const p = d.pro; const b = d.business;
  return (
    <section className="space-y-10">
      <div>
        <H sub="This is what customers see first. Your phone number and email are never shown publicly.">Your profile</H>
        <div className="mb-6 flex items-center gap-4"><Avatar name={p?.display_name ?? d.profile?.full_name ?? "You"} path={d.profile?.avatar_path ?? null} className="h-20 w-20 text-2xl" /><PublicImageUpload userId={userId} folder="avatar" label={d.profile?.avatar_path ? "Change photo" : "Add profile photo"} onDone="avatar" /></div>
        <ActionForm action={saveProfessionalProfile} submitLabel="Save and continue">
          <fieldset className="grid gap-3 sm:grid-cols-2"><legend className={lab}>Account type</legend>
            {[["individual", "Individual professional"], ["business", "Registered business"]].map(([v, l]) => <label key={v} className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-line bg-surface p-3 font-bold has-[:checked]:border-forest"><input type="radio" name="accountType" value={v} defaultChecked={(p?.account_type ?? "individual") === v} className="accent-forest" />{l}</label>)}</fieldset>
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="fullName" className={lab}>Full legal name</label><input id="fullName" name="fullName" required defaultValue={d.profile?.full_name} className={inp} autoComplete="name" /></div><div><label htmlFor="phone" className={lab}>Phone number</label><input id="phone" name="phone" type="tel" required defaultValue={d.profile?.phone ?? ""} className={inp} placeholder="+2348012345678" autoComplete="tel" /></div></div>
          <LocationSelect states={states} name="locationId" label="Where are you based?" initialId={d.profile?.location_id} initialLabel={d.locationName} required={!d.profile?.location_id} />
          <div><label htmlFor="displayName" className={lab}>Trading or professional name</label><input id="displayName" name="displayName" required maxLength={80} defaultValue={p?.display_name} className={inp} placeholder="e.g. Ade Plumbing Services" /></div>
          <div><label htmlFor="headline" className={lab}>Short headline (optional)</label><input id="headline" name="headline" maxLength={120} defaultValue={p?.headline ?? ""} className={inp} /></div>
          <div><label htmlFor="bio" className={lab}>About you and your work</label><textarea id="bio" name="bio" maxLength={2000} rows={5} defaultValue={p?.bio ?? ""} className={`${inp} h-auto py-3`} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="years" className={lab}>Years of experience</label><input id="years" name="yearsExperience" type="number" min={0} max={80} required defaultValue={p?.years_experience ?? ""} className={inp} /></div>
            <div><label htmlFor="cat" className={lab}>Main service category</label><select id="cat" name="primaryCategoryId" required defaultValue={p?.primary_category_id ?? ""} className={inp}><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
        </ActionForm>
      </div>
      {p?.account_type === "business" && (
        <div id="business">
          <H sub="Required for registered businesses. Only the registered name and logo are shown publicly.">Business details</H>
          {businessBanner && !b && <p role="status" className="mb-4 rounded-2xl bg-mint-50 p-3 text-sm font-semibold">Profile saved. Now add your business details.</p>}
          <ActionForm action={saveBusiness} submitLabel="Save business details">
            <div><label htmlFor="rn" className={lab}>Registered business name</label><input id="rn" name="registeredName" required maxLength={120} defaultValue={String(b?.registered_name ?? "")} className={inp} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="rc" className={lab}>Registration number (optional)</label><input id="rc" name="registrationNumber" maxLength={40} defaultValue={String(b?.registration_number ?? "")} className={inp} /></div><div><label htmlFor="ye" className={lab}>Year established (optional)</label><input id="ye" name="yearEstablished" type="number" min={1900} defaultValue={b?.year_established ?? ""} className={inp} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="be" className={lab}>Business email (optional)</label><input id="be" name="email" type="email" defaultValue={String(b?.email ?? "")} className={inp} /></div><div><label htmlFor="bp" className={lab}>Business phone (optional)</label><input id="bp" name="phone" type="tel" defaultValue={String(b?.phone ?? "")} className={inp} /></div></div>
            <div><label htmlFor="bw" className={lab}>Website (optional)</label><input id="bw" name="website" type="url" defaultValue={String(b?.website ?? "")} className={inp} placeholder="https://" /></div>
            <div><label htmlFor="ba" className={lab}>Business address (optional, private)</label><input id="ba" name="addressLine" maxLength={200} defaultValue={String(b?.address_line ?? "")} className={inp} /></div>
          </ActionForm>
        </div>)}
      {p && <Next to="/workspace/onboarding/services" />}
    </section>
  );
}

export function ServicesStep({ d, categories }: { d: OnboardingData; categories: CategoryRow[] }) {
  return (
    <section className="space-y-8">
      <H sub="List what you do. Prices are indicative; the final amount is agreed in a quotation. You can add more later.">Services and pricing</H>
      {d.services.length > 0 && <ul className="divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{d.services.map((s) => <li key={s.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-extrabold">{s.name}</p><p className="text-sm text-forest">{priceLabel(s.pricing_type as PricingType, s.price_minor)}</p></div><Remove action={removeService} id={s.id} label={`Remove ${s.name}`} /></li>)}</ul>}
      <div className="rounded-card bg-mint-50 p-5 ring-1 ring-line"><h3 className="mb-4 font-extrabold">Add a service</h3><ActionForm action={addService} submitLabel="Add service"><ServiceFields categories={categories} defaultCategoryId={d.pro?.primary_category_id} /></ActionForm></div>
      <div className="flex gap-3"><Next to="/workspace/onboarding/profile" label="Back" />{d.services.length > 0 && <Next to="/workspace/onboarding/coverage" />}</div>
    </section>
  );
}

export function CoverageStep({ d, states }: { d: OnboardingData; states: LocationOption[] }) {
  return (
    <section className="space-y-8">
      <H sub="Add every area you serve: a whole state, a city or a neighbourhood. Customers searching those areas will find you.">Where you work</H>
      {d.coverage.length > 0 && <ul className="divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{d.coverage.map((c) => <li key={c.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-extrabold">{c.locations?.name}</p><p className="text-sm capitalize text-ink-muted">{c.locations?.level}{c.travel_available ? " · travels to customers" : ""}{c.remote_available ? " · remote available" : ""}</p></div><Remove action={removeCoverage} id={c.id} label="Remove area" /></li>)}</ul>}
      <div className="rounded-card bg-mint-50 p-5 ring-1 ring-line"><h3 className="mb-4 font-extrabold">Add an area</h3>
        <ActionForm action={addCoverage} submitLabel="Add area"><LocationSelect states={states} name="locationId" label="Area" required />
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="travel" className="h-5 w-5 accent-forest" />I travel to customers here</label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="remote" className="h-5 w-5 accent-forest" />I can also help remotely</label></ActionForm></div>
      <div className="flex gap-3"><Next to="/workspace/onboarding/services" label="Back" />{d.coverage.length > 0 && <Next to="/workspace/onboarding/portfolio" />}</div>
    </section>
  );
}

export function PortfolioStep({ d, userId }: { d: OnboardingData; userId: string }) {
  return (
    <section className="space-y-8">
      <H sub="Optional but strongly recommended. Real photos of your own work build trust. JPG, PNG or WebP, up to 5 MB each.">Portfolio</H>
      {d.portfolio.map((item) => (
        <article key={item.id} className="rounded-card bg-surface p-5 shadow-soft">
          <div className="flex items-start justify-between gap-4"><div><h3 className="font-extrabold">{item.title}</h3>{item.description && <p className="text-sm text-ink-muted">{item.description}</p>}</div><Remove action={removePortfolioItem} id={item.id} label={`Remove ${item.title}`} /></div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{item.portfolio_media.map((m) => { const u = publicMediaUrl(m.storage_path); return u ? /* eslint-disable-next-line @next/next/no-img-element */ <img key={m.id} src={u} alt="" loading="lazy" className="aspect-square w-full rounded-2xl object-cover" /> : null; })}</div>
          <div className="mt-3"><PublicImageUpload userId={userId} folder={`portfolio/${item.id}`} label="Add photo" onDone={{ itemId: item.id }} /></div>
        </article>))}
      <div className="rounded-card bg-mint-50 p-5 ring-1 ring-line"><h3 className="mb-4 font-extrabold">Add a project</h3>
        <ActionForm action={createPortfolioItem} submitLabel="Add project">
          <div><label htmlFor="pt" className={lab}>Project title</label><input id="pt" name="title" required maxLength={100} className={inp} /></div>
          <div><label htmlFor="pd" className={lab}>What did you do? (optional)</label><textarea id="pd" name="description" maxLength={500} rows={2} className={`${inp} h-auto py-3`} /></div>
          <div><label htmlFor="pc" className={lab}>Completed on (optional)</label><input id="pc" name="completedOn" type="date" className={inp} /></div>
        </ActionForm></div>
      <div className="flex gap-3"><Next to="/workspace/onboarding/coverage" label="Back" /><Next to="/workspace/onboarding/availability" label={d.portfolio.length ? "Continue" : "Skip for now"} /></div>
    </section>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function AvailabilityStep({ d }: { d: OnboardingData }) {
  const by = new Map(d.availability.map((a) => [a.weekday, a]));
  return (
    <section className="space-y-8">
      <H sub="Tell customers when you usually work. Times are Nigerian time. Optional, and you can change them any time.">Working hours</H>
      <ActionForm action={saveAvailability} submitLabel="Save working hours">
        <ul className="space-y-2">{DAYS.map((day, i) => { const a = by.get(i); return (
          <li key={day} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft"><label className="flex w-36 items-center gap-2 font-bold"><input type="checkbox" name={`d${i}_on`} defaultChecked={!!a} className="h-5 w-5 accent-forest" />{day}</label>
            <label className="sr-only" htmlFor={`s${i}`}>{day} opens</label><input id={`s${i}`} type="time" name={`d${i}_start`} defaultValue={a?.start_time.slice(0, 5) ?? "08:00"} className="h-11 rounded-xl border-2 border-line px-2" /><span aria-hidden="true">to</span>
            <label className="sr-only" htmlFor={`e${i}`}>{day} closes</label><input id={`e${i}`} type="time" name={`d${i}_end`} defaultValue={a?.end_time.slice(0, 5) ?? "17:00"} className="h-11 rounded-xl border-2 border-line px-2" /></li>); })}</ul>
      </ActionForm>
      <div><h3 className="mb-3 font-extrabold">Days off</h3>
        {d.exceptions.length > 0 && <ul className="mb-4 divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{d.exceptions.map((e) => <li key={e.id} className="flex items-center justify-between gap-4 py-3"><span>{e.starts_on}{e.ends_on !== e.starts_on ? ` to ${e.ends_on}` : ""}{e.reason ? ` · ${e.reason}` : ""}</span><Remove action={removeDayOff} id={e.id} label="Remove day off" /></li>)}</ul>}
        <ActionForm action={addDayOff} submitLabel="Add days off" secondary><div className="grid gap-4 sm:grid-cols-3"><div><label htmlFor="do1" className={lab}>From</label><input id="do1" name="startsOn" type="date" required className={inp} /></div><div><label htmlFor="do2" className={lab}>To</label><input id="do2" name="endsOn" type="date" required className={inp} /></div><div><label htmlFor="do3" className={lab}>Reason (optional)</label><input id="do3" name="reason" maxLength={100} className={inp} /></div></div></ActionForm></div>
      <div className="flex gap-3"><Next to="/workspace/onboarding/portfolio" label="Back" /><Next to="/workspace/onboarding/documents" /></div>
    </section>
  );
}

const reviewTone = (s: string) => (s === "accepted" ? "success" : s === "rejected" ? "danger" : "warning") as "success" | "danger" | "warning";
export function DocumentsStep({ d }: { d: OnboardingData }) {
  const open = EDITABLE.includes(d.status);
  const docsFor = (id: string | null) => d.docs.filter((x) => x.requirement_id === id);
  const row = (x: OnboardingData["docs"][number]) => (
    <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mint-50 p-3 text-sm">
      <span className="font-semibold">{x.file_name}</span>
      <span className="flex items-center gap-3">{!x.uploaded_at ? <Badge tone="warning">Upload not finished</Badge> : <Badge tone={reviewTone(x.review_status)}>{x.review_status === "pending" ? "Awaiting review" : x.review_status}</Badge>}
        {x.uploaded_at && <ViewDocumentButton documentId={x.id} />}{open && x.review_status !== "accepted" && <Remove action={removeDocument} id={x.id} label={`Remove ${x.file_name}`} />}</span>
      {x.review_note && <p className="basis-full text-danger">Reviewer note: {x.review_note}</p>}
    </li>);
  return (
    <section className="space-y-8">
      <H sub="Your files are stored privately and are seen only by you and DECA reviewers. They are never shown on your public profile.">Verification documents</H>
      {!open && <p role="status" className="rounded-2xl bg-mint-50 p-4 text-sm font-semibold">Your application is {d.status.replace(/_/g, " ")}. Submitted documents cannot be changed. If DECA needs more information it will reopen your application.</p>}
      {d.reqs.length === 0 && <p className="text-ink-muted">Finish your profile and services first so we can show the documents that apply to you.</p>}
      <ul className="space-y-6">{d.reqs.map((r) => (
        <li key={r.id} className="rounded-card bg-surface p-5 shadow-soft">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{r.name}</h3><Badge tone={r.is_required ? "warning" : "neutral"}>{r.is_required ? "Required" : "Optional"}</Badge></div>
          {r.description && <p className="mt-1 text-sm text-ink-muted">{r.description}</p>}
          <ul className="mt-3 space-y-2">{docsFor(r.id).map(row)}</ul>
          <div className="mt-3"><DocumentUploader requirementId={r.id} label={docsFor(r.id).length ? "Upload another file" : "Upload file"} disabled={!open} /></div>
          <p className="mt-2 text-xs text-ink-muted">JPG, PNG or PDF, up to 10 MB.</p>
        </li>))}</ul>
      <div className="rounded-card bg-surface p-5 shadow-soft"><h3 className="font-extrabold">Other supporting documents</h3><p className="text-sm text-ink-muted">Anything else DECA asked for, such as references or extra certificates.</p>
        <ul className="mt-3 space-y-2">{docsFor(null).map(row)}</ul><div className="mt-3"><DocumentUploader requirementId={null} label="Upload file" /></div></div>
      <div className="flex gap-3"><Next to="/workspace/onboarding/availability" label="Back" /><Next to="/workspace/onboarding/review" /></div>
    </section>
  );
}

export function ReviewStep({ d }: { d: OnboardingData }) {
  const ok = readyToSubmit(d.steps); const submitted = !EDITABLE.includes(d.status);
  return (
    <section className="space-y-8">
      <H sub="Check each step, accept the policies and submit. DECA reviewers will check your documents. Nothing is verified automatically.">Review and submit</H>
      <ul className="divide-y divide-line rounded-card bg-surface px-5 shadow-soft">{d.steps.filter((s) => s.key !== "review").map((s) => <li key={s.key} className="flex items-center justify-between py-3"><Link href={`/workspace/onboarding/${s.key}`} className="font-bold text-forest">{s.label}</Link><Badge tone={s.done ? "success" : s.blocking ? "warning" : "neutral"}>{s.done ? "Done" : s.blocking ? "Needed" : "Optional"}</Badge></li>)}</ul>
      {submitted ? <div role="status" className="rounded-card bg-mint-50 p-5 ring-1 ring-line"><p className="flex items-center gap-2 font-extrabold">Status: <VerificationBadge status={d.status as VerificationStatus} /></p><p className="mt-2 text-sm text-ink-muted">You can follow progress on your workspace overview.</p></div> :
        !ok ? <p className="rounded-2xl bg-warning/10 p-4 text-sm font-semibold">Complete the steps marked Needed to submit.</p> :
        <ActionForm action={acceptAndSubmit} submitLabel="Accept policies and submit for verification">
          <fieldset className="space-y-3"><legend className={lab}>Please read and accept</legend>
            {d.requiredPolicies.filter(isPolicyKey).map((k) => <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" name={`policy_${k}`} required className="mt-1 h-5 w-5 accent-forest" /><span>I accept the <Link href={`/legal/${k}`} target="_blank" className="font-bold text-forest underline">{POLICY_TITLES[k]}</Link>.</span></label>)}</fieldset>
          <p className="text-xs text-ink-muted">Once submitted, your evidence is locked while DECA reviews it.</p>
        </ActionForm>}
    </section>
  );
}
