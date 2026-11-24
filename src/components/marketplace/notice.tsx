import Link from "next/link";

export function Notice({ title, children, action }: { title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-card bg-mint-50 p-8 text-center ring-1 ring-line">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
      {action && <Link href={action.href} className="mt-5 inline-flex h-11 items-center rounded-control bg-forest px-6 font-bold text-white hover:bg-forest-700">{action.label}</Link>}
    </div>
  );
}
