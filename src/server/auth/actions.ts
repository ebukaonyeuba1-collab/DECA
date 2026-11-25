"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { HOME_FOR_ROLE, type UserRole } from "@/lib/domain";
import { safeNext } from "@/lib/safe-redirect";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "./schemas";

export type FormState = { error?: string; notice?: string; fieldErrors?: Record<string, string>; ok?: boolean };

function issues(error: import("zod").ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) { const k = String(i.path[0] ?? "form"); fieldErrors[k] ??= i.message; }
  return { error: Object.values(fieldErrors)[0] ?? "Check the form and try again.", fieldErrors };
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // One generic message for unknown email, wrong password and unconfirmed email: no account enumeration.
  if (error || !data.user) return { error: "Email or password is incorrect, or the email has not been confirmed yet." };
  const { data: p } = await supabase.from("profiles").select("role,status").eq("id", data.user.id).maybeSingle();
  if (!p || p.status !== "active") { await supabase.auth.signOut(); return { error: "This account is not active. Contact DECA support." }; }
  redirect(safeNext(form.get("next"), HOME_FOR_ROLE[p.role as UserRole]));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return issues(parsed.error);
  const { email, password, fullName, phone, role, locationId, marketingConsent } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email, password,
    options: {
      // Read by the sign-up trigger. Role is limited to customer or professional there as well.
      data: { full_name: fullName, phone, role, location_id: locationId ?? "", privacy_consent: "true", marketing_consent: marketingConsent ? "true" : "false" },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent("/login?confirmed=1")}`,
    },
  });
  if (error && /password|weak|short/i.test(error.message)) return { error: "Choose a stronger password (at least 10 characters).", fieldErrors: { password: "Choose a stronger password" } };
  if (error && error.status === 429) return { error: "Too many attempts. Please wait a few minutes and try again." };
  // Same message whether or not the email already exists, and for any other failure: no account enumeration.
  return { notice: "Check your email to confirm your account, then sign in.", ok: true };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return issues(parsed.error);
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent("/reset-password")}` });
  return { notice: "If an account exists for that email, we have sent a reset link.", ok: true };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return issues(parsed.error);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "We could not update your password. Choose a different one or request a new link." };
  redirect("/login?reset=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
