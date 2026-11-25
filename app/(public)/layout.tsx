import { MobileNav } from "@/components/marketplace/mobile-nav";
import { SiteFooter } from "@/components/marketplace/site-footer";
import { SiteHeader } from "@/components/marketplace/site-header";

export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <><SiteHeader /><div className="min-h-[60dvh]">{children}</div><SiteFooter /><MobileNav /></>;
}
