import { LoginForm } from "@/components/auth-form";
export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; confirmed?: string; error?: string; reset?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-extrabold">Sign in</h1>
      {sp.confirmed && <p role="status" className="mt-3 text-sm font-semibold text-success">Email confirmed. You can sign in now.</p>}
      {sp.reset && <p role="status" className="mt-3 text-sm font-semibold text-success">Password updated. Sign in with your new password.</p>}
      {sp.error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">That link could not be used. If you just confirmed your email, you can sign in now. For a password reset, request a new link.</p>}
      <div className="mt-8"><LoginForm next={sp.next} /></div>
    </main>
  );
}
