import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HOME_FOR_ROLE, type UserRole } from "@/lib/domain";

export type SessionUser = { id: string; email: string | null; role: UserRole; fullName: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("role,status,full_name").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "active") return null;
  return { id: user.id, email: user.email ?? null, role: p.role as UserRole, fullName: p.full_name ?? "" };
}

/** Call at the top of every protected layout and server action. */
export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(HOME_FOR_ROLE[user.role]);
  return user;
}
