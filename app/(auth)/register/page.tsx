import { RegisterForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/env";
import { listLocations } from "@/server/discovery/queries";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const states = isSupabaseConfigured() ? await listLocations(null).catch(() => []) : [];
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-extrabold">Create your DECA account</h1>
      <p className="mt-2 text-sm text-ink-muted">Professionals complete their profile and verification after confirming their email.</p>
      <div className="mt-8"><RegisterForm states={states} /></div>
    </main>
  );
}
