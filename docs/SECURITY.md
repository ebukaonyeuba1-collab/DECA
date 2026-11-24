# DECA security model

Status: Stage 1 foundation after review. Controls below are implemented in migrations `0001` to `0012` and `src/`. "Test" names the check that exercises each control (see TESTING.md for what has actually been run).

| Threat | Control | Test |
|---|---|---|
| User grants themselves admin | Sign-up metadata limited to customer/professional; role and status triggers | smoke: metadata, role, status |
| Professional approves own verification | Protected columns trigger; decisions only via admin functions | smoke: self-approval, decide own application |
| Approval without evidence | `review_verification` requires every required document individually accepted | hardening: approval blocked |
| Evidence altered or deleted after submission | Window-gated soft removal, immutable file fields, no hard delete for clients or admins, append-only events | hardening: locked: * (9 checks) |
| Document row and file drift apart | Upload only against a pending record; no storage update/delete policies; confirm-after-upload; reconcile function | hardening: storage * and reconcile * |
| Others reading ID documents | Private bucket, owner-or-admin read, signed URLs | hardening: other user / anon cannot read |
| Private data leaking through public discovery | Views only, explicit columns, base-table grants revoked, no partner access to `profiles` | hardening: scan, anon base tables, business, partner |
| Forged payment success | No client write grants; DB requires server verification fields; status machine | hardening: forge / unverified / mismatch / backwards |
| Webhook replay or forgery | HMAC-SHA512 on raw body, unique event id, size and shape validation | unit: webhook (8) and signature (3); live HTTP checks; hardening: replay |
| Money moving before it is legally supported | `custody_mode` and payouts guarded by a super-admin feature flag | hardening: custody, payouts |
| Commission on cancelled jobs | Insert only when booking is completed; null rate records nothing | smoke |
| Cross-user data access | RLS on every table, default deny, participant helpers | smoke: other customer/professional/outsider |
| Tampering with logs and ledger | Append-only triggers | smoke: ledger, audit |

## Assumptions and residual risks
- **Internal flag.** Server functions raise a transaction-local flag (`deca.internal`) so triggers allow their own updates. Clients cannot call the flag setter, and PostgREST runs one RPC per transaction, so the flag cannot carry across client actions. Direct database connections are trusted (service role, migrations). The database tests reset the flag between simulated requests to model this.
- **Service role is powerful.** It bypasses RLS and can delete evidence (needed for lawful erasure). Keep it server-only; never import `src/lib/supabase/service.ts` in client code (a unit test guards this).
- **Admin accounts.** Admins can read verification files and conversations. Stage 8 must add access logging for file reads and MFA for admin sign-in.
- **Uploads.** MIME type and size limits are bucket-level; malware scanning and image sanitisation are not implemented.
- **Rate limiting** is not implemented yet (sign-up, uploads, messages, webhooks).
- **Storage policies** were tested against a stand-in `storage` schema, not Supabase's. Re-run `supabase/tests/20_hardening.sql` on a Supabase stack before relying on them.
- **NDPA.** Consent text, retention periods and erasure procedures need legal review before real users are onboarded.
