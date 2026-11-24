// Mirrors the database enums. Regenerate exact types with `npm run db:types` once Supabase is running.
export type UserRole = "customer" | "professional" | "admin" | "super_admin";
export const ADMIN_ROLES: UserRole[] = ["admin", "super_admin"];

export type VerificationStatus = "not_started" | "incomplete" | "submitted" | "under_review" | "additional_information_required" | "approved" | "rejected" | "suspended";
export type BookingStatus = "pending" | "quotation_requested" | "quotation_sent" | "awaiting_approval" | "confirmed" | "awaiting_payment" | "payment_secured" | "scheduled" | "in_progress" | "awaiting_customer_confirmation" | "completed" | "cancelled" | "disputed" | "refunded";

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  not_started: "Not started", incomplete: "Incomplete", submitted: "Submitted", under_review: "Under review",
  additional_information_required: "More information needed", approved: "Approved", rejected: "Rejected", suspended: "Suspended",
};
export const BOOKING_LABEL: Record<BookingStatus, string> = {
  pending: "Pending", quotation_requested: "Quotation requested", quotation_sent: "Quotation sent", awaiting_approval: "Awaiting approval",
  confirmed: "Confirmed", awaiting_payment: "Awaiting payment", payment_secured: "Payment secured", scheduled: "Scheduled",
  in_progress: "In progress", awaiting_customer_confirmation: "Awaiting your confirmation", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed", refunded: "Refunded",
};
/** Where each role lands after sign-in. */
export const HOME_FOR_ROLE: Record<UserRole, string> = { customer: "/account", professional: "/workspace", admin: "/admin", super_admin: "/admin" };
/** Route prefixes and the roles allowed in. Enforced in middleware AND again in each layout. */
export const ROUTE_ROLES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin", roles: ADMIN_ROLES },
  { prefix: "/workspace", roles: ["professional"] },
  { prefix: "/account", roles: ["customer"] },
];
