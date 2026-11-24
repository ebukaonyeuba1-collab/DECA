import { LoginForm } from "@/components/auth-form";
export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; confirmed?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-extrabold">Sign in</h1>
      {sp.confirmed && <p role="status" className="mt-3 text-sm text-success">Email confirmed. You can sign in now.</p>}
      {sp.error && <p role="alert" className="mt-3 text-sm text-danger">That confirmation link is invalid or expired.</p>}
      <div className="mt-8"><LoginForm next={sp.next} /></div>
    </main>
  );
}
