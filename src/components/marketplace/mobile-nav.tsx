"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Home, Search, User, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", Icon: Home }, { href: "/explore", label: "Explore", Icon: Search }, { href: "/explore", label: "Request Service", Icon: Wrench, center: true },
  { href: "/account", label: "Bookings", Icon: CalendarCheck }, { href: "/account", label: "Profile", Icon: User },
];
export function MobileNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <ul className="relative flex h-16 items-center justify-around rounded-[2rem] bg-forest-900 px-2 text-mint">
        {items.map(({ href, label, Icon, center }, i) => center
          ? <li key={i} className="-mt-9"><Link href={href} aria-label={label} className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-[#3ec68f] to-forest-700 text-white shadow-lift ring-[7px] ring-canvas"><Icon className="h-7 w-7" aria-hidden="true" /></Link></li>
          : <li key={i}><Link href={href} className={cn("flex w-14 flex-col items-center gap-0.5 text-[11px] font-semibold", path === href && i < 2 ? "text-[#5ff0a8]" : "text-mint/70")}><Icon className="h-6 w-6" aria-hidden="true" />{label}</Link></li>)}
      </ul>
    </nav>
  );
}
