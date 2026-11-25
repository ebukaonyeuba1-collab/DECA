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

## Stage 3 additions
| Threat | Control | Test |
|---|---|---|
| Choosing an admin role at sign-up | Zod enum plus trigger limit to customer/professional | unit: registration; smoke |
| Account enumeration | Identical messages for sign-in failures, sign-up and password reset | code review (not exercised against Supabase) |
| Open redirect after login | `safeNext` allows same-site paths only | unit: 11 cases |
| Malicious upload types or oversize files | Client check, server check, bucket limits (10 MB docs, 5 MB images) | unit: file validation; DB: bucket limits |
| Path traversal or someone else's file path | Server builds paths from the session user id and a UUID; prefix checks for public media | unit: filename sanitiser; DB: storage policies |
| Script links on profiles | Website must be http(s) | unit: business schema |
| Submitting without accepting policies | Database refuses submission; versioned re-acceptance | DB: onboarding suite |
| Secret keys in the browser | Server-only env module; canary build scan; guard tests | build scan: 0 secret values, 0 secret names in client files |
| Reading evidence through the app | Owner-only signed links (60 s); admin links require admin role | DB: storage policies; not exercised with real signed URLs |

## Assumptions and residual risks
- **Internal flag.** Server functions raise a transaction-local flag (`deca.internal`) so triggers allow their own updates. Clients cannot call the flag setter, and PostgREST runs one RPC per transaction, so the flag cannot carry across client actions. Direct database connections are trusted (service role, migrations). The database tests reset the flag between simulated requests to model this.
- **Service role is powerful.** It bypasses RLS and can delete evidence (needed for lawful erasure). Keep it server-only; never import `src/lib/supabase/service.ts` in client code (a unit test guards this).
- **Admin accounts.** Admins can read verification files and conversations. Stage 8 must add access logging for file reads and MFA for admin sign-in.
- **Uploads.** MIME type and size limits are bucket-level; malware scanning and image sanitisation are not implemented.
- **Rate limiting** is not implemented yet (sign-up, uploads, messages, webhooks).
- **Storage policies** were tested against a stand-in `storage` schema, not Supabase's. Re-run `supabase/tests/20_hardening.sql` on a Supabase stack before relying on them.
- **NDPA.** Consent text, retention periods and erasure procedures need legal review before real users are onboarded.
- **Not exercised against real Supabase Auth:** email confirmation, password reset, session refresh and signed URLs have not run against a live project. See STAGE3.md acceptance scenarios.
- **Email-link flow** is PKCE based; cross-device links can fail (see STAGE3.md).
