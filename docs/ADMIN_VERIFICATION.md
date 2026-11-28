# Admin verification and professional management

## What changed
- **Views:** `/admin/verification` now has Pending (the original queue, oldest submission first and the default), Approved, Rejected, Suspended, Not submitted and All, each with a live count.
- **Nothing disappears.** Approving or rejecting moves a professional between views; the record, documents, history and public profile data are never deleted. Approved professionals stay under Approved; rejected ones stay under Rejected with the reason shown in the list and on the detail page.
- **Search and filters:** professional name, business name or email (administrators only), verification status, category (main category or any service) and location (matches where they are based or serve, and understands the hierarchy: a state finds its cities). Filters combine, survive tab changes, and work with paging (20 per page).
- **Detail page** `/admin/verification/[id]`: current decision banner, complete profile and private contact details, business information, services and pricing, service areas, portfolio, every submitted document (including ones the professional later removed, flagged as removed), full verification history, and accepted policies with versions. The decision form sits beside the content on desktop and above it on mobile.
- **Documents** open only through signed links that expire after 60 seconds. No public URL exists for them.
- **Decision history** records the administrator (name and ID), the decision, the previous state, the reason and the time. It cannot be edited or deleted.

## Database change (migration 0015, genuinely needed)
No new tables and no new status fields. Status is `professional_profiles.verification_status` (already synced from the application); history is `verification_events` (already recorded who, what, why, when).
- `admin_list_professionals(...)` and `admin_verification_counts()`: read-only, administrator-only, one place for the cross-table search and location hierarchy.
- `review_verification` now stores only the latest decision's reason on the application. Previously an approval after a rejection kept showing the old rejection reason; earlier reasons remain in the history.
- History timestamps use the true insertion time so ordering is always reliable.

## Security (unchanged model)
Every page requires an admin role, every function re-checks it, and RLS is untouched: administrators read through their own session. No service-role key is used. Customers, professionals and anonymous visitors are refused by the listing functions (tested). Evidence rows still cannot be deleted by anyone through the app.

## Known limitations
- Listing and detail pages were not rendered against a live Supabase.
- No bulk actions, CSV export or assignment of reviewers.
- Location filter on the list uses "Selected area" as the label after search because only the id is in the URL.
- Records of professionals who never registered an application show "Not submitted" and have no detail page until they submit.
