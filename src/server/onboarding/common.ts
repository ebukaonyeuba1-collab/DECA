import "server-only";
import type { ZodError, ZodTypeAny, z } from "zod";
import type { FormState } from "@/server/auth/actions";

export function zodState(error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return { error: Object.values(fieldErrors)[0] ?? "Check the form and try again.", fieldErrors };
}
export function parseForm<S extends ZodTypeAny>(schema: S, form: FormData): { data: z.infer<S> } | { state: FormState } {
  const r = schema.safeParse(Object.fromEntries(form));
  return r.success ? { data: r.data } : { state: zodState(r.error) };
}
/**
 * Maps database errors to safe messages. Messages we raise ourselves in SQL (SQLSTATE P0001) are written for users
 * and are passed through; everything else is generic so internals never leak.
 */
export function dbMessage(error: { code?: string; message: string } | null | undefined, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  if (error.code === "P0001") return error.message.replace(/^.*?:\s*/, "").slice(0, 200);
  if (error.code === "23505") return "That already exists.";
  if (error.code === "42501" || error.code === "PGRST301") return "You do not have permission to do that.";
  return fallback;
}
