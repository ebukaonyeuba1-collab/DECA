import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PAYMENTS_PROVIDER: z.enum(["paystack"]).default("paystack"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PROTECTED_PAYMENTS_ENABLED: z.enum(["true", "false"]).default("false"),
});

/** Literal property access so Next can inline NEXT_PUBLIC_* values in the browser bundle. */
export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
export function isSupabaseConfigured(): boolean {
  return publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }).success;
}
export function serverEnv() {
  return serverSchema.parse(process.env);
}
