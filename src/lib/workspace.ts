import type { BookingStatus } from "./domain";

export const WORKSPACE_NAV = [
  { key: "overview", label: "Overview", href: "/workspace" },
  { key: "enquiries", label: "Enquiries", href: "/workspace/enquiries" },
  { key: "quotations", label: "Quotations", href: "/workspace/quotations" },
  { key: "jobs", label: "Jobs", href: "/workspace/jobs" },
  { key: "messages", label: "Messages", href: "/workspace/messages" },
  { key: "customers", label: "Customers", href: "/workspace/customers" },
  { key: "earnings", label: "Earnings", href: "/workspace/earnings" },
  { key: "profile", label: "Profile", href: "/workspace/profile" },
  { key: "services", label: "Services", href: "/workspace/services" },
  { key: "portfolio", label: "Portfolio", href: "/workspace/portfolio" },
  { key: "availability", label: "Availability", href: "/workspace/availability" },
  { key: "verification", label: "Verification", href: "/workspace/verification" },
  { key: "analytics", label: "Analytics", href: "/workspace/analytics" },
  { key: "settings", label: "Settings", href: "/workspace/settings" },
] as const;

/** The overview matches only itself; every other section also matches its sub-pages. */
export function isActiveNav(pathname: string, href: string): boolean {
  return href === "/workspace" ? pathname === "/workspace" : pathname === href || pathname.startsWith(href + "/");
}

export type Dashboard = {
  professional_id?: string; verification_status?: string; rating_avg?: number; review_count?: number;
  enquiries_new?: number; quotations_draft?: number; quotations_pending?: number; bookings_upcoming?: number; jobs_active?: number; jobs_completed?: number;
  unread_messages?: number; gross_completed_minor?: number; commission_minor?: number; payout_pending_minor?: number; payout_paid_minor?: number;
  by_status?: Record<string, number>; quotations_sent_total?: number;
};
/** Net earnings are what is left after commission that has actually been recorded. */
export function netEarningsMinor(d: Dashboard): number { return Math.max(0, (d.gross_completed_minor ?? 0) - (d.commission_minor ?? 0)); }

/** Funnel counts from real bookings only. Nothing here is estimated. */
export function funnel(d: Dashboard) {
  const s = d.by_status ?? {}; const n = (k: string) => Number(s[k] ?? 0);
  const total = Object.values(s).reduce((a, b) => a + Number(b), 0);
  const reachedConfirmed = n("confirmed") + n("awaiting_payment") + n("payment_secured") + n("scheduled") + n("in_progress") + n("awaiting_customer_confirmation") + n("completed") + n("disputed") + n("refunded");
  return { enquiries: total, quoted: Number(d.quotations_sent_total ?? 0), accepted: reachedConfirmed, completed: n("completed"), cancelled: n("cancelled"), disputed: n("disputed") };
}
export const pct = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "No data yet");

/** What a professional may do to a booking. Mirrors the database transition table; the database remains the authority. */
export type JobAction = { to: BookingStatus; label: string; danger?: boolean };
export function jobActionsFor(status: BookingStatus): JobAction[] {
  switch (status) {
    case "quotation_requested": return [{ to: "cancelled", label: "Decline enquiry", danger: true }];
    case "confirmed": return [{ to: "scheduled", label: "Schedule job" }, { to: "cancelled", label: "Cancel", danger: true }];
    case "payment_secured": return [{ to: "scheduled", label: "Schedule job" }, { to: "in_progress", label: "Start job" }];
    case "scheduled": return [{ to: "in_progress", label: "Start job" }, { to: "cancelled", label: "Cancel", danger: true }];
    case "in_progress": return [{ to: "awaiting_customer_confirmation", label: "Submit for customer confirmation" }];
    default: return [];
  }
}
export const PROFESSIONAL_SETTABLE: BookingStatus[] = ["scheduled", "in_progress", "awaiting_customer_confirmation", "cancelled"];
export const JOB_NOTE_STATUSES: BookingStatus[] = ["scheduled", "in_progress", "awaiting_customer_confirmation"];

/** True when saving these values on an approved profile sends it back to review (the database enforces this too). */
export function triggersReview(verificationStatus: string, before: { accountType: string; categoryId: string | null }, after: { accountType: string; categoryId: string | null }): boolean {
  return verificationStatus === "approved" && (before.accountType !== after.accountType || before.categoryId !== after.categoryId);
}

export type CompletionInput = { displayName: boolean; headline: boolean; bio: boolean; experience: boolean; category: boolean; photo: boolean; services: boolean; coverage: boolean; portfolio: boolean; availability: boolean; documents: boolean };
const WEIGHTS: Record<keyof CompletionInput, number> = { displayName: 10, headline: 5, bio: 10, experience: 5, category: 10, photo: 10, services: 15, coverage: 10, portfolio: 10, availability: 5, documents: 10 };
export function profileCompletion(c: CompletionInput): { percent: number; missing: (keyof CompletionInput)[] } {
  const keys = Object.keys(WEIGHTS) as (keyof CompletionInput)[];
  const percent = keys.reduce((sum, k) => sum + (c[k] ? WEIGHTS[k] : 0), 0);
  return { percent, missing: keys.filter((k) => !c[k]) };
}
export const COMPLETION_LABEL: Record<keyof CompletionInput, { text: string; href: string }> = {
  displayName: { text: "Add your professional name", href: "/workspace/profile" }, headline: { text: "Write a short headline", href: "/workspace/profile" },
  bio: { text: "Describe your work", href: "/workspace/profile" }, experience: { text: "Add years of experience", href: "/workspace/profile" },
  category: { text: "Choose your main category", href: "/workspace/profile" }, photo: { text: "Add a profile photo", href: "/workspace/profile" },
  services: { text: "Add a service with pricing", href: "/workspace/services" }, coverage: { text: "Add the areas you serve", href: "/workspace/services" },
  portfolio: { text: "Add portfolio photos", href: "/workspace/portfolio" }, availability: { text: "Set your working hours", href: "/workspace/availability" },
  documents: { text: "Upload the required documents", href: "/workspace/onboarding/documents" },
};
