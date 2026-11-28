import { requireRole } from "@/server/auth/session";
import { signOut } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import { WorkspaceNav } from "@/components/workspace/nav";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["professional"]);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:px-8">
        <span className="font-extrabold text-forest">DECA <span className="font-semibold text-ink-muted">| Workspace</span></span>
        <form action={signOut} className="flex items-center gap-3"><span className="hidden text-sm text-ink-muted sm:inline">{user.fullName || user.email}</span><Button size="sm" variant="secondary">Sign out</Button></form>
      </header>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 pb-32 lg:grid-cols-[13rem_1fr] lg:px-8 lg:pb-10">
        <aside className="lg:sticky lg:top-20 lg:self-start"><WorkspaceNav /></aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
