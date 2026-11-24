"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth/session";

const input = z.object({ professionalId: z.string().uuid(), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80) });

/** Save or unsave a professional. Customers only; RLS also restricts rows to the signed-in customer. */
export async function toggleSaved(formData: FormData): Promise<void> {
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { professionalId, slug } = parsed.data;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/professionals/${slug}`)}`);
  if (user.role !== "customer") return;
  const supabase = await createClient();
  const visible = await supabase.from("public_professionals").select("id").eq("id", professionalId).maybeSingle();
  if (!visible.data) return;   // only approved, listed professionals can be saved
  const existing = await supabase.from("saved_professionals").select("professional_id").eq("professional_id", professionalId).maybeSingle();
  if (existing.data) await supabase.from("saved_professionals").delete().eq("customer_id", user.id).eq("professional_id", professionalId);
  else await supabase.from("saved_professionals").insert({ customer_id: user.id, professional_id: professionalId });
  revalidatePath("/explore"); revalidatePath(`/professionals/${slug}`);
}
