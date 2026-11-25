import "server-only";
import { z } from "zod";

// Server-only: importing this from a client component fails the build. Secrets never enter browser bundles.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),       // holds the secret (or legacy service_role) key
  PAYMENTS_PROVIDER: z.enum(["paystack"]).default("paystack"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PROTECTED_PAYMENTS_ENABLED: z.enum(["true", "false"]).default("false"),
});

export function serverEnv() {
  return serverSchema.parse({ ...process.env, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY });
}
