import Link from "next/link";
import { PAGE_SIZE, toQueryString, type DiscoveryParams } from "@/lib/discovery-params";

export function Pagination({ params, total, basePath }: { params: DiscoveryParams; total: number; basePath: string }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const link = (page: number) => `${basePath}${toQueryString(params, { page: page > 1 ? page : undefined })}`;
  const cls = "inline-flex h-11 items-center rounded-control px-5 font-bold ring-2 ring-inset ring-forest text-forest hover:bg-mint-100";
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
      {params.page > 1 ? <Link href={link(params.page - 1)} className={cls} rel="prev">Previous</Link> : <span />}
      <span className="text-sm text-ink-muted">Page {params.page} of {pages}</span>
      {params.page < pages ? <Link href={link(params.page + 1)} className={cls} rel="next">Next</Link> : <span />}
    </nav>
  );
}
