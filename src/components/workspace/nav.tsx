"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, FileText, Home, Inbox, User } from "lucide-react";
import { WORKSPACE_NAV, isActiveNav } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/** Desktop: full sidebar. Mobile: the five-item bottom bar from the product spec (Home, Enquiries, central work action, Jobs, Profile). */
export function WorkspaceNav() {
  const path = usePathname();
  const mobile = [
    { href: "/workspace", label: "Home", Icon: Home }, { href: "/workspace/enquiries", label: "Enquiries", Icon: Inbox },
    { href: "/workspace/quotations", label: "Quotations", Icon: FileText, center: true },
    { href: "/workspace/jobs", label: "Jobs", Icon: CalendarClock }, { href: "/workspace/profile", label: "Profile", Icon: User },
  ];
  return (
    <>
      <nav aria-label="Workspace" className="hidden lg:block">
        <ul className="space-y-1">{WORKSPACE_NAV.map((n) => <li key={n.key}><Link href={n.href} aria-current={isActiveNav(path, n.href) ? "page" : undefined} className={cn("flex h-11 items-center rounded-2xl px-4 text-sm font-bold", isActiveNav(path, n.href) ? "bg-forest text-white" : "text-ink hover:bg-mint-100")}>{n.label}</Link></li>)}</ul>
      </nav>
      <nav aria-label="Workspace shortcuts" className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <ul className="flex h-16 items-center justify-around rounded-[2rem] bg-forest-900 px-2 text-mint">
          {mobile.map(({ href, label, Icon, center }) => center
            ? <li key={href} className="-mt-9"><Link href={href} aria-label={label} className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-[#3ec68f] to-forest-700 text-white shadow-lift ring-[7px] ring-canvas"><Icon className="h-7 w-7" aria-hidden="true" /></Link></li>
            : <li key={href}><Link href={href} className={cn("flex w-14 flex-col items-center gap-0.5 text-[11px] font-semibold", isActiveNav(path, href) ? "text-[#5ff0a8]" : "text-mint/70")}><Icon className="h-6 w-6" aria-hidden="true" />{label}</Link></li>)}
        </ul>
      </nav>
    </>
  );
}
