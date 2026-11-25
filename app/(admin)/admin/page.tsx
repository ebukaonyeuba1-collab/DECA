import Link from "next/link";
export const metadata = { title: "Administration" };
export default function Page() {
  return <><h1 className="text-3xl font-extrabold">Administration</h1><p className="mt-2 text-ink-muted">The full dashboard arrives in Stage 8.</p><Link href="/admin/verification" className="mt-6 inline-flex h-12 items-center rounded-control bg-forest px-6 font-bold text-white">Verification queue</Link></>;
}
