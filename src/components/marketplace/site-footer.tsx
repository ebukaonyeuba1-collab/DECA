import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-mint-50 pb-28 pt-10 md:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 text-sm text-ink-muted md:flex-row md:justify-between">
        <div><p className="text-xl font-extrabold text-forest">DECA</p><p className="mt-1 max-w-xs">Good work starts with the right connection.</p></div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-2 font-semibold"><Link href="/explore">Explore professionals</Link><Link href="/register">Join as a professional</Link><Link href="/login">Sign in</Link></nav>
        <p>© Deca Ltd</p>
      </div>
    </footer>
  );
}
