"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { HOME_FOR_ROLE, type UserRole } from "@/lib/domain";
import { loginSchema, registerSchema } from "./schemas";

export type FormState = { error?: string; notice?: string };

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Email or password is incorrect." };
  const { data: p } = await supabase.from("profiles").select("role,status").eq("id", data.user.id).maybeSingle();
  if (!p || p.status !== "active") { await supabase.auth.signOut(); return { error: "This account is not active. Contact DECA support." }; }
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : HOME_FOR_ROLE[p.role as UserRole]);
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { email, password, fullName, phone, role } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email, password, phone,
    options: { data: { full_name: fullName, role }, emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { notice: "Check your email to confirm your account, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
