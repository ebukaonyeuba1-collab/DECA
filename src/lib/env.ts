import { z } from "zod";

// Supabase renamed its keys: "publishable" replaces "anon", "secret" replaces "service_role".
// Either name works. Literal property access is required so Next.js can inline NEXT_PUBLIC_* in browser bundles.
function publicKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}
export function supabasePublicConfig(): { url: string | undefined; key: string | undefined } {
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined, key: publicKey() };
}

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),   // holds the publishable (or legacy anon) key
});
export function publicEnv() {
  const { url, key } = supabasePublicConfig();
  return publicSchema.parse({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key });
}
export function isSupabaseConfigured(): boolean {
  const { url, key } = supabasePublicConfig();
  return publicSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key }).success;
}
