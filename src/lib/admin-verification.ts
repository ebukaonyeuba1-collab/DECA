import { VERIFICATION_LABEL, type VerificationStatus } from "./domain";

export const ADMIN_GROUPS = [
  { key: "pending", label: "Pending", hint: "Waiting for a decision or for more information" },
  { key: "approved", label: "Approved", hint: "Verified and listed" },
  { key: "rejected", label: "Rejected", hint: "Declined, with reasons" },
  { key: "suspended", label: "Suspended", hint: "Removed from public listing" },
  { key: "not_started", label: "Not submitted", hint: "Registered but not yet submitted" },
  { key: "all", label: "All", hint: "Every professional" },
] as const;
export type AdminGroup = (typeof ADMIN_GROUPS)[number]["key"];
export const ADMIN_PAGE_SIZE = 20;
export const ALL_STATUSES = Object.keys(VERIFICATION_LABEL) as VerificationStatus[];

export type AdminParams = { group: AdminGroup; q?: string; status?: VerificationStatus; category?: string; loc?: string; page: number };
type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Untrusted URL input in, safe typed filters out. Invalid values are dropped, never thrown. */
export function parseAdminParams(raw: Raw): AdminParams {
  const g = (k: string) => first(raw[k]);
  const group = ADMIN_GROUPS.find((x) => x.key === g("group"))?.key ?? "pending";
  const status = ALL_STATUSES.find((s) => s === g("status"));
  const category = g("category"); const loc = g("l"); const page = Number(g("page"));
  return {
    group, q: g("q")?.trim().slice(0, 80) || undefined, status,
    category: category && category.length <= 80 && SLUG.test(category) ? category : undefined,
    loc: loc && UUID.test(loc) ? loc : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
  };
}
export function adminQuery(p: Partial<AdminParams>, overrides: Partial<Record<keyof AdminParams | "l", string | number | undefined>> = {}): string {
  const out = new URLSearchParams();
  const base: Record<string, unknown> = { group: p.group && p.group !== "pending" ? p.group : undefined, q: p.q, status: p.status, category: p.category, l: p.loc, page: p.page && p.page > 1 ? p.page : undefined };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v !== undefined && v !== "") out.set(k, String(v));
  const s = out.toString();
  return s ? `?${s}` : "";
}
export function toAdminRpcArgs(p: AdminParams) {
  return { p_group: p.group, p_status: p.status ?? null, p_query: p.q ?? null, p_category: p.category ?? null, p_location: p.loc ?? null, p_limit: ADMIN_PAGE_SIZE, p_offset: (p.page - 1) * ADMIN_PAGE_SIZE };
}

export type HistoryEvent = { event_type: string; from_status: string | null; to_status: string | null; message: string | null };
const label = (s: string | null) => (s && s in VERIFICATION_LABEL ? VERIFICATION_LABEL[s as VerificationStatus] : s ?? "");
/** Human wording for a history row. The reason always travels with the decision. */
export function describeEvent(e: HistoryEvent): { title: string; detail: string | null } {
  switch (e.event_type) {
    case "submitted": return { title: "Application submitted", detail: null };
    case "admin_decision": return { title: `Decision: ${label(e.to_status)}`, detail: [e.from_status ? `From ${label(e.from_status)}` : null, e.message ? `Reason: ${e.message}` : null].filter(Boolean).join(". ") || null };
    case "document_accepted": return { title: "Document accepted", detail: e.message };
    case "document_rejected": return { title: "Document rejected", detail: e.message ? `Reason: ${e.message}` : null };
    case "sensitive_change": return { title: "Sensitive profile change", detail: e.message };
    case "document_pending": return { title: "Document set back to pending", detail: e.message };
    default: return { title: e.event_type.replace(/_/g, " "), detail: e.message };
  }
}
