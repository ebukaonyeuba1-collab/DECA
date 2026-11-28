"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/server/auth/session";
import type { FormState } from "@/server/auth/actions";
import { nairaToKobo } from "@/lib/naira";
import { PROFESSIONAL_SETTABLE, JOB_NOTE_STATUSES, triggersReview } from "@/lib/workspace";
import { dbMessage, parseForm } from "@/server/onboarding/common";
import { professionalProfileSchema, serviceSchema } from "@/server/onboarding/schemas";

async function pro() {
  const user = await requireRole(["professional"]);
  const supabase = await createClient();
  const { data } = await supabase.from("professional_profiles").select("id,account_type,primary_category_id,verification_status").eq("user_id", user.id).maybeSingle();
  return { user, supabase, profile: data as { id: string; account_type: string; primary_category_id: string | null; verification_status: string } | null };
}
const refresh = () => { revalidatePath("/workspace", "layout"); };

/** Profile edits from the workspace. Changing category or account type on an approved profile sends it back to review. */
export async function updateProfessionalProfile(_: FormState, form: FormData): Promise<FormState> {
  const { user, supabase, profile } = await pro();
  if (!profile) return { error: "Complete your profile in setup first." };
  const r = parseForm(professionalProfileSchema, form); if ("state" in r) return r.state;
  const d = r.data;
  const p = await supabase.from("profiles").update({ full_name: d.fullName, phone: d.phone, ...(d.locationId ? { location_id: d.locationId } : {}) }).eq("id", user.id);
  if (p.error) return { error: dbMessage(p.error) };
  const u = await supabase.from("professional_profiles").update({ account_type: d.accountType, display_name: d.displayName, headline: d.headline ?? null, bio: d.bio ?? null, years_experience: d.yearsExperience, primary_category_id: d.primaryCategoryId }).eq("id", profile.id);
  if (u.error) return { error: dbMessage(u.error) };
  refresh();
  return triggersReview(profile.verification_status, { accountType: profile.account_type, categoryId: profile.primary_category_id }, { accountType: d.accountType, categoryId: d.primaryCategoryId })
    ? { notice: "Saved. Because you changed your category or account type, DECA will review your profile again. It is hidden from search until a reviewer decides.", ok: true }
    : { notice: "Profile saved.", ok: true };
}

export async function updateService(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return { error: "Complete your profile first." };
  const id = z.string().uuid().safeParse(form.get("id")); if (!id.success) return { error: "Service not found." };
  const r = parseForm(serviceSchema, form); if ("state" in r) return r.state;
  const d = r.data;
  const u = await supabase.from("professional_services").update({
    category_id: d.categoryId, subcategory_id: d.subcategoryId ?? null, name: d.name, description: d.description ?? null, inclusions: d.inclusions ?? null, exclusions: d.exclusions ?? null,
    additional_charges: d.additionalCharges ?? null, pricing_type: d.pricingType, price_minor: nairaToKobo(d.price), minimum_charge_minor: nairaToKobo(d.minimumCharge), duration_minutes: d.durationMinutes ?? null,
  }).eq("id", id.data).eq("professional_id", profile.id).is("deleted_at", null);
  if (u.error) return { error: dbMessage(u.error, "We could not save that service.") };
  refresh(); return { notice: "Service updated.", ok: true };
}

export async function saveCustomerNote(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await pro(); if (!profile) return { error: "Complete your profile first." };
  const parsed = z.object({ customerId: z.string().uuid(), note: z.string().trim().max(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the note and try again." };
  const { customerId, note } = parsed.data;
  const res = note === ""
    ? await supabase.from("professional_customer_notes").delete().eq("professional_id", profile.id).eq("customer_id", customerId)
    : await supabase.from("professional_customer_notes").upsert({ professional_id: profile.id, customer_id: customerId, note }, { onConflict: "professional_id,customer_id" });
  if (res.error) return { error: dbMessage(res.error, "We could not save the note.") };
  refresh(); return { notice: note === "" ? "Note removed." : "Note saved. Only you can see it.", ok: true };
}

/** Moves a booking along. The database checks the transition table for the professional role; this list only narrows it further. */
export async function updateJobStatus(_: FormState, form: FormData): Promise<FormState> {
  await pro();
  const parsed = z.object({ id: z.string().uuid(), to: z.string(), note: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success || !(PROFESSIONAL_SETTABLE as string[]).includes(parsed.data.to)) return { error: "That change is not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_booking", { p_booking: parsed.data.id, p_to: parsed.data.to, p_note: parsed.data.note || null });
  if (error) return { error: dbMessage(error, "We could not update that job.") };
  refresh(); return { notice: "Updated.", ok: true };
}

export async function addJobUpdate(_: FormState, form: FormData): Promise<FormState> {
  const { user, supabase, profile } = await pro(); if (!profile) return { error: "Complete your profile first." };
  const parsed = z.object({ id: z.string().uuid(), message: z.string().trim().min(2, "Write a short update").max(1000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Write a short update." };
  const { data: b } = await supabase.from("bookings").select("status").eq("id", parsed.data.id).eq("professional_id", profile.id).maybeSingle();
  if (!b || !(JOB_NOTE_STATUSES as string[]).includes((b as { status: string }).status)) return { error: "Updates can be added while a job is scheduled or in progress." };
  const ins = await supabase.from("job_updates").insert({ booking_id: parsed.data.id, author_id: user.id, message: parsed.data.message });
  if (ins.error) return { error: dbMessage(ins.error) };
  refresh(); return { notice: "Update added.", ok: true };
}
