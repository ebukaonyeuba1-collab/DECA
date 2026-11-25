"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/server/auth/session";
import type { FormState } from "@/server/auth/actions";
import { dbMessage } from "@/server/onboarding/common";

const ADMIN = ["admin", "super_admin"] as const;
const STATUSES = ["under_review", "additional_information_required", "approved", "rejected", "suspended"] as const;
const DOC_STATUSES = ["accepted", "rejected", "pending"] as const;

export async function reviewDocumentAction(_: FormState, form: FormData): Promise<FormState> {
  await requireRole([...ADMIN]);
  const status = String(form.get("status")); const id = String(form.get("id") ?? "");
  if (!(DOC_STATUSES as readonly string[]).includes(status)) return { error: "Invalid decision." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_document", { p_document: id, p_status: status, p_note: String(form.get("note") ?? "").slice(0, 500) || null });
  if (error) return { error: dbMessage(error) };
  revalidatePath("/admin/verification", "layout"); return { notice: "Saved.", ok: true };
}
export async function decideApplicationAction(_: FormState, form: FormData): Promise<FormState> {
  await requireRole([...ADMIN]);
  const decision = String(form.get("decision")); const id = String(form.get("id") ?? "");
  if (!(STATUSES as readonly string[]).includes(decision)) return { error: "Invalid decision." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_verification", { p_application: id, p_decision: decision, p_reason: String(form.get("reason") ?? "").slice(0, 500) || null, p_notes: String(form.get("notes") ?? "").slice(0, 1000) || null });
  if (error) return { error: dbMessage(error) };
  revalidatePath("/admin/verification", "layout"); return { notice: "Decision recorded.", ok: true };
}
/** Short-lived signed link for a reviewer. Storage policy allows only the owner and administrators. */
export async function getAdminDocumentUrl(documentId: string): Promise<{ url: string } | { error: string }> {
  await requireRole([...ADMIN]);
  const supabase = await createClient();
  const { data } = await supabase.from("professional_documents").select("storage_path").eq("id", documentId).maybeSingle();
  if (!data) return { error: "Document not found." };
  const s = await supabase.storage.from("verification-documents").createSignedUrl(data.storage_path, 60);
  return s.error || !s.data ? { error: "Could not open the document." } : { url: s.data.signedUrl };
}
