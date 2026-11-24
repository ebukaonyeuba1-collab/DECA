import { requireRole } from "@/server/auth/session";
import { signOut } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["professional"]);
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-4">
        <span className="font-extrabold text-forest">DECA <span className="font-semibold text-ink-muted">| Professional workspace</span></span>
        <form action={signOut} className="flex items-center gap-3"><span className="hidden text-sm text-ink-muted sm:inline">{user.fullName || user.email}</span><Button size="sm" variant="secondary">Sign out</Button></form>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
