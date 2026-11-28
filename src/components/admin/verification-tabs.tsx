import Link from "next/link";
import { ADMIN_GROUPS, adminQuery, type AdminParams } from "@/lib/admin-verification";
import { cn } from "@/lib/utils";

/** Pending, Approved, Rejected (and the rest) as links. Filters are kept when switching views. */
export function VerificationTabs({ params, counts }: { params: AdminParams; counts: Record<string, number> }) {
  return (
    <nav aria-label="Verification views" className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2">
        {ADMIN_GROUPS.map((g) => (
          <li key={g.key}>
            <Link href={`/admin/verification${adminQuery(params, { group: g.key === "pending" ? undefined : g.key, status: undefined, page: undefined })}`} title={g.hint}
              aria-current={params.group === g.key ? "page" : undefined}
              className={cn("flex h-11 items-center gap-2 whitespace-nowrap rounded-control px-4 text-sm font-bold", params.group === g.key ? "bg-forest text-white" : "bg-surface text-forest ring-1 ring-line hover:bg-mint-100")}>
              {g.label}<span className={cn("rounded-control px-2 py-0.5 text-xs", params.group === g.key ? "bg-white/20" : "bg-mint-100")}>{counts[g.key] ?? 0}</span>
            </Link>
          </li>))}
      </ul>
    </nav>
  );
}
