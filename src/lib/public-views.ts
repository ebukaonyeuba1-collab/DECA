/**
 * Stage 2 rule: public and customer-facing discovery reads ONLY these views (or server-side queries that
 * select an explicit column list). The base tables below are private to their owners and administrators.
 */
export const PUBLIC_VIEWS = [
  "public_professionals", "public_professional_services", "public_service_coverage",
  "public_portfolio", "public_reviews", "public_availability",
] as const;

/** Never query these from discovery code or any browser-reachable code path. */
export const PRIVATE_BASE_TABLES = [
  "profiles", "customer_profiles", "user_addresses", "professional_profiles", "businesses", "professional_services",
  "service_locations", "professional_availability", "availability_exceptions", "portfolio_items", "portfolio_media",
  "reviews", "review_responses", "professional_documents", "verification_applications", "verification_events",
  "payout_accounts", "payouts", "payment_transactions", "payment_events", "ledger_entries", "messages", "conversations",
] as const;
