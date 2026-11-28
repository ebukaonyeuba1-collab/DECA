# Stage 4: professional workspace

**Status: implemented and tested locally. Not yet exercised against your real Supabase project.**

## What professionals get
Desktop sidebar, and on mobile the five-item bottom bar from the spec (Home, Enquiries, central Quotations action, Jobs, Profile; the Profile page lists every section).
| Section | What it does today |
|---|---|
| Overview | Real figures: new enquiries, quotes awaiting the customer, upcoming bookings, active and completed jobs, unread messages, rating, net earnings; profile completion with the exact missing items; verification status, reviewer messages, recent activity |
| Enquiries | Requests from customers; review and decline with an optional reason |
| Quotations | Quotes prepared and sent, with totals and status (the builder comes in Stage 6) |
| Jobs | Upcoming, in progress, completed, cancelled; schedule, start, submit for customer confirmation, cancel; progress notes. Only the customer can confirm completion |
| Messages | Conversation list with unread counts (reading and replying come in Stage 6) |
| Customers | People you dealt with, names masked (first name and initial), counts, and a private note per customer |
| Earnings | Completed job value, recorded commission, net, pending and paid payouts, transactions (test payments labelled) |
| Profile | Edit profile and business details; sensitive-change warning |
| Services | Add, edit (prices, inclusions, duration), remove; service areas |
| Portfolio, Availability | Manage photos and projects; weekly hours and days off |
| Verification | Status, reviewer message, your documents (opened through 60-second links), history, policies accepted |
| Analytics | Funnel from real bookings only. Profile views and response times are not tracked, so they are not shown |
| Settings | Account, plan (Free; paid plans not available), privacy, sign out |

## Database (migration 0016; genuinely needed, re-runnable)
- `professional_customer_notes`: the only new table. Visible only to the professional who wrote it (no admin policy) and only for customers they have dealt with.
- `professional_dashboard()` (SECURITY INVOKER, so row level security limits it to the caller's own data) and `professional_customers()` (names masked, no contact details).
- **Sensitive changes after approval:** changing the account type, the main category, or the registered business name or number returns an approved profile to review. It is hidden from search, the change is recorded in the verification history, and it appears in the administrators' pending view. Ordinary edits (headline, bio, services, prices, hours, portfolio) apply immediately. The professional cannot restore approval themselves.

## Honest limits
- Enquiries cannot yet be answered or quoted from the UI, and customers cannot yet create enquiries; both arrive in Stage 6. The database functions for them already exist and were tested.
- While a profile is under review after a sensitive change, its documents are locked; an administrator must choose "Request more information" to let the professional upload documents for a new category.
- No page was rendered against a live Supabase; layout and accessibility were not reviewed on devices.
