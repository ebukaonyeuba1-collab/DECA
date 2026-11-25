"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/server/auth/session";
import type { FormState } from "@/server/auth/actions";
import { nairaToKobo } from "@/lib/naira";
import { slugify, withSuffix } from "@/lib/slug";
import { DOCUMENT_MAX_BYTES, safeFileName, validateUpload } from "@/lib/files";
import { isPolicyKey } from "@/lib/policies";
import { dbMessage, parseForm } from "./common";
import { businessSchema, coverageSchema, customerProfileSchema, dayOffSchema, documentRecordSchema, parseAvailability, portfolioItemSchema, professionalProfileSchema, serviceSchema } from "./schemas";

const PRO = ["professional"] as const;
async function pro() {
  const user = await requireRole([...PRO]);
  const supabase = await createClient();
  const { data } = await supabase.from("professional_profiles").select("id,account_type,business_id").eq("user_id", user.id).maybeSingle();
  return { user, supabase, profile: data as { id: string; account_type: string; business_id: string | null } | null };
}
const needProfile: FormState = { error: "Complete your profile first." };
const done = (path: string) => revalidatePath(path);

// ---------- customer ----------
export async function saveCustomerProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole(["customer"]);
  const r = parseForm(customerProfileSchema, form); if ("state" in r) return r.state;
  const supabase = await createClient();
  const a = await supabase.from("profiles").update({ full_name: r.data.fullName, phone: r.data.phone, ...(r.data.locationId ? { location_id: r.data.locationId } : {}) }).eq("id", user.id);
  if (a.error) return { error: dbMessage(a.error) };
  if (r.data.locationId) await supabase.from("customer_profiles").update({ preferred_location_id: r.data.locationId }).eq("user_id", user.id);
  done("/account"); return { notice: "Profile saved.", ok: true };
}

// ---------- professional: profile and business ----------
export async function saveProfessionalProfile(_: FormState, form: FormData): Promise<FormState> {
  const { user, supabase, profile } = await pro();
  const r = parseForm(professionalProfileSchema, form); if ("state" in r) return r.state;
  const d = r.data;
  const p = await supabase.from("profiles").update({ full_name: d.fullName, phone: d.phone, ...(d.locationId ? { location_id: d.locationId } : {}) }).eq("id", user.id);
  if (p.error) return { error: dbMessage(p.error) };
  const fields = { account_type: d.accountType, display_name: d.displayName, headline: d.headline ?? null, bio: d.bio ?? null, years_experience: d.yearsExperience, primary_category_id: d.primaryCategoryId };
  if (profile) {
    const u = await supabase.from("professional_profiles").update(fields).eq("id", profile.id);
    if (u.error) return { error: dbMessage(u.error) };
  } else {
    const base = slugify(d.displayName);
    for (let i = 0; i < 4; i++) {
      const slug = i === 0 ? base : withSuffix(base, i);
      const ins = await supabase.from("professional_profiles").insert({ user_id: user.id, slug, ...fields });
      if (!ins.error) break;
      if (ins.error.code !== "23505" || i === 3) return { error: dbMessage(ins.error, "We could not create your profile. Please try again.") };
    }
  }
  done("/workspace");
  redirect(d.accountType === "business" && !profile?.business_id ? "/workspace/onboarding/profile?business=1" : "/workspace/onboarding/services");
}

export async function saveBusiness(_: FormState, form: FormData): Promise<FormState> {
  const { user, supabase, profile } = await pro();
  if (!profile) return needProfile;
  if (profile.account_type !== "business") return { error: "Switch your account type to Registered business first." };
  const r = parseForm(businessSchema, form); if ("state" in r) return r.state;
  const d = r.data;
  const row = { registered_name: d.registeredName, registration_number: d.registrationNumber ?? null, description: d.description ?? null, address_line: d.addressLine ?? null, email: d.email ?? null, phone: d.phone ?? null, year_established: d.yearEstablished ?? null, website: d.website ?? null };
  if (profile.business_id) {
    const u = await supabase.from("businesses").update(row).eq("id", profile.business_id).eq("owner_user_id", user.id);
    if (u.error) return { error: dbMessage(u.error) };
  } else {
    const ins = await supabase.from("businesses").insert({ owner_user_id: user.id, ...row }).select("id").single();
    if (ins.error || !ins.data) return { error: dbMessage(ins.error) };
    const link = await supabase.from("professional_profiles").update({ business_id: ins.data.id }).eq("id", profile.id);
    if (link.error) return { error: dbMessage(link.error) };
  }
  done("/workspace"); return { notice: "Business details saved.", ok: true };
}

export async function setAvatar(path: string): Promise<FormState> {
  const user = await requireRole(["professional", "customer"]);
  if (typeof path !== "string" || !path.startsWith(`${user.id}/avatar/`) || path.includes("..") || path.length > 200) return { error: "Invalid file." };
  const supabase = await createClient();
  const u = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (u.error) return { error: dbMessage(u.error) };
  done("/workspace"); done("/account"); return { notice: "Photo updated.", ok: true };
}

// ---------- professional: services, coverage, availability, portfolio ----------
export async function addService(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const r = parseForm(serviceSchema, form); if ("state" in r) return r.state;
  const d = r.data;
  const ins = await supabase.from("professional_services").insert({
    professional_id: profile.id, category_id: d.categoryId, subcategory_id: d.subcategoryId ?? null, name: d.name, description: d.description ?? null,
    inclusions: d.inclusions ?? null, exclusions: d.exclusions ?? null, additional_charges: d.additionalCharges ?? null, pricing_type: d.pricingType,
    price_minor: nairaToKobo(d.price), minimum_charge_minor: nairaToKobo(d.minimumCharge), duration_minutes: d.durationMinutes ?? null,
  });
  if (ins.error) return { error: dbMessage(ins.error, "We could not save that service.") };
  done("/workspace/onboarding/services"); return { notice: "Service added.", ok: true };
}
export async function removeService(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const id = String(form.get("id") ?? "");
  const u = await supabase.from("professional_services").update({ is_active: false, deleted_at: new Date().toISOString() }).eq("id", id).eq("professional_id", profile.id);
  if (u.error) return { error: dbMessage(u.error) };
  done("/workspace/onboarding/services"); return { ok: true };
}
export async function addCoverage(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const r = parseForm(coverageSchema, form); if ("state" in r) return r.state;
  const ins = await supabase.from("service_locations").insert({ professional_id: profile.id, location_id: r.data.locationId, travel_available: !!r.data.travel, remote_available: !!r.data.remote });
  if (ins.error) return { error: ins.error.code === "23505" ? "You already added that area." : dbMessage(ins.error) };
  done("/workspace/onboarding/coverage"); return { notice: "Area added.", ok: true };
}
export async function removeCoverage(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const d = await supabase.from("service_locations").delete().eq("id", String(form.get("id") ?? "")).eq("professional_id", profile.id);
  if (d.error) return { error: dbMessage(d.error) };
  done("/workspace/onboarding/coverage"); return { ok: true };
}
export async function saveAvailability(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const r = parseAvailability(form); if ("error" in r) return { error: r.error };
  const del = await supabase.from("professional_availability").delete().eq("professional_id", profile.id).is("service_id", null);
  if (del.error) return { error: dbMessage(del.error) };
  if (r.slots.length) {
    const ins = await supabase.from("professional_availability").insert(r.slots.map((s) => ({ professional_id: profile.id, weekday: s.weekday, start_time: s.start, end_time: s.end })));
    if (ins.error) return { error: dbMessage(ins.error) };
  }
  done("/workspace/onboarding/availability"); return { notice: "Working hours saved.", ok: true };
}
export async function addDayOff(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const r = parseForm(dayOffSchema, form); if ("state" in r) return r.state;
  const ins = await supabase.from("availability_exceptions").insert({ professional_id: profile.id, starts_on: r.data.startsOn, ends_on: r.data.endsOn, reason: r.data.reason ?? null });
  if (ins.error) return { error: dbMessage(ins.error) };
  done("/workspace/onboarding/availability"); return { notice: "Days off saved.", ok: true };
}
export async function removeDayOff(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const d = await supabase.from("availability_exceptions").delete().eq("id", String(form.get("id") ?? "")).eq("professional_id", profile.id);
  if (d.error) return { error: dbMessage(d.error) };
  done("/workspace/onboarding/availability"); return { ok: true };
}
export async function createPortfolioItem(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const r = parseForm(portfolioItemSchema, form); if ("state" in r) return r.state;
  const ins = await supabase.from("portfolio_items").insert({ professional_id: profile.id, title: r.data.title, description: r.data.description ?? null, completed_on: r.data.completedOn ?? null, category_id: r.data.categoryId ?? null });
  if (ins.error) return { error: dbMessage(ins.error) };
  done("/workspace/onboarding/portfolio"); return { notice: "Project added. Now add photos to it.", ok: true };
}
export async function addPortfolioMedia(itemId: string, path: string, kind: "work" | "before" | "after" = "work"): Promise<FormState> {
  const { user, supabase, profile } = await pro(); if (!profile) return needProfile;
  if (!path.startsWith(`${user.id}/portfolio/`) || path.includes("..") || path.length > 250 || !["work", "before", "after"].includes(kind)) return { error: "Invalid file." };
  const item = await supabase.from("portfolio_items").select("id").eq("id", itemId).eq("professional_id", profile.id).maybeSingle();
  if (!item.data) return { error: "Project not found." };
  const ins = await supabase.from("portfolio_media").insert({ portfolio_item_id: itemId, storage_path: path, media_type: "image", kind });
  if (ins.error) return { error: dbMessage(ins.error) };
  done("/workspace/onboarding/portfolio"); return { ok: true };
}
export async function removePortfolioItem(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const u = await supabase.from("portfolio_items").update({ deleted_at: new Date().toISOString() }).eq("id", String(form.get("id") ?? "")).eq("professional_id", profile.id);
  if (u.error) return { error: dbMessage(u.error) };
  done("/workspace/onboarding/portfolio"); return { ok: true };
}

// ---------- verification documents (private bucket) ----------
/** Step 1 of 3: create the database record. The browser then uploads to the path returned, then calls confirmDocumentUpload. */
export async function createDocumentRecord(input: { requirementId?: string | null; fileName: string; mime: string; size: number }): Promise<{ error: string } | { documentId: string; path: string }> {
  const { user, supabase, profile } = await pro(); if (!profile) return { error: "Complete your profile first." };
  const parsed = documentRecordSchema.safeParse({ requirementId: input.requirementId || undefined, fileName: input.fileName, mime: input.mime, size: input.size });
  if (!parsed.success) return { error: "Invalid file details." };
  const { requirementId, fileName, mime, size } = parsed.data;
  const bad = validateUpload({ type: mime, size }, "document"); if (bad) return { error: bad };
  if (size > DOCUMENT_MAX_BYTES) return { error: "Files must be 10 MB or smaller." };
  if (requirementId) {
    const { data: reqs } = await supabase.rpc("applicable_requirements", { p_professional: profile.id });
    if (!(reqs ?? []).some((q: { id: string }) => q.id === requirementId)) return { error: "That requirement does not apply to you." };
  }
  const id = crypto.randomUUID();
  const path = `${user.id}/${id}/${safeFileName(fileName, mime)}`;
  const ins = await supabase.from("professional_documents").insert({ id, professional_id: profile.id, requirement_id: requirementId ?? null, storage_path: path, file_name: fileName.slice(0, 200), mime_type: mime, size_bytes: size });
  if (ins.error) return { error: dbMessage(ins.error, "We could not start that upload.") };
  return { documentId: id, path };
}
/** Step 3 of 3: the database confirms the file really reached storage before it counts toward submission. */
export async function confirmDocumentUpload(documentId: string): Promise<FormState> {
  const { supabase } = await pro();
  const { error } = await supabase.rpc("confirm_document_upload", { p_document: documentId });
  if (error) return { error: dbMessage(error, "The upload could not be confirmed. Try again.") };
  done("/workspace/onboarding/documents"); return { ok: true };
}
export async function removeDocument(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await pro();
  const u = await supabase.from("professional_documents").update({ deleted_at: new Date().toISOString() }).eq("id", String(form.get("id") ?? ""));
  if (u.error) return { error: dbMessage(u.error, "This document cannot be removed.") };
  done("/workspace/onboarding/documents"); return { ok: true };
}
/** Short-lived link to the owner's own document. Storage policy lets only the owner (or an admin) read it. */
export async function getDocumentUrl(documentId: string): Promise<{ url: string } | { error: string }> {
  const { supabase } = await pro();
  const { data } = await supabase.from("professional_documents").select("storage_path,deleted_at").eq("id", documentId).maybeSingle();
  if (!data || data.deleted_at) return { error: "Document not found." };
  const signed = await supabase.storage.from("verification-documents").createSignedUrl(data.storage_path, 60);
  return signed.error || !signed.data ? { error: "Could not open the document." } : { url: signed.data.signedUrl };
}

// ---------- submission ----------
export async function acceptAndSubmit(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return needProfile;
  const { data: setting } = await supabase.from("platform_settings").select("value").eq("key", "policies").maybeSingle();
  const required: string[] = (setting?.value?.professional_required ?? []).filter(isPolicyKey);
  const missing = required.filter((k) => form.get(`policy_${k}`) !== "on");
  if (missing.length) return { error: "Please accept every policy to continue." };
  const acc = await supabase.rpc("accept_policies", { p_keys: required });
  if (acc.error) return { error: dbMessage(acc.error, "We could not record your acceptance.") };
  const sub = await supabase.rpc("submit_verification_application");
  if (sub.error) return { error: dbMessage(sub.error, "We could not submit your application.") };
  done("/workspace"); redirect("/workspace?submitted=1");
}
