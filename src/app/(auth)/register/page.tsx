import { RegisterForm } from "@/components/auth-form";
export const metadata = { title: "Create account" };
export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-extrabold">Create your DECA account</h1>
      <p className="mt-2 text-sm text-ink-muted">Professionals complete onboarding and verification after sign-up (Stage 3).</p>
      <div className="mt-8"><RegisterForm /></div>
    </main>
  );
}
