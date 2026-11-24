import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { HOME_FOR_ROLE } from "@/lib/domain";
import { isSupabaseConfigured } from "@/lib/env";
import { getSelectedLocation } from "@/server/discovery/location";
import { listLocations } from "@/server/discovery/queries";
import { LocationPicker } from "./location-picker";

export async function SiteHeader() {
  const configured = isSupabaseConfigured();
  const [user, location, states] = configured
    ? await Promise.all([getSessionUser().catch(() => null), getSelectedLocation(), listLocations(null).catch(() => [])])
    : [null, null, []];
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-forest">DECA</Link>
        <nav aria-label="Primary" className="ml-6 hidden gap-5 text-sm font-bold md:flex"><Link href="/explore" className="hover:text-forest-700">Explore</Link><Link href="/register" className="hover:text-forest-700">Become a professional</Link></nav>
        <div className="ml-auto flex items-center gap-2">
          {states.length > 0 && <LocationPicker states={states} current={location} variant="header" />}
          {user
            ? <Link href={HOME_FOR_ROLE[user.role]} className="inline-flex h-10 items-center rounded-control bg-forest px-4 text-sm font-bold text-white">{user.fullName.split(" ")[0] || "Account"}</Link>
            : <><Link href="/login" className="hidden h-10 items-center px-3 text-sm font-bold text-forest sm:inline-flex">Sign in</Link><Link href="/register" className="inline-flex h-10 items-center rounded-control bg-forest px-4 text-sm font-bold text-white">Join</Link></>}
        </div>
      </div>
    </header>
  );
}
