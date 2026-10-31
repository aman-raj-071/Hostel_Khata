# Hostel Khata: completion and verification

## Current delivery

Phases 0–4 are committed; Phase 5 adds final hardening, deployment configuration, documentation and regression checks. Original Lovable layout is retained. Wispr Flow supplies ordinary text; review/save is explicit. Razorpay is excluded as requested.

## Retired control audit

Executed from repository root:

    rg -n -i 'speech|recognition|voice|\bmic\b|click 5|likho|balances kholo|waveform' src

Result: no output, exit 1 (no matches). Removed runtime control/provider/hook/parser/help/transcript/waveform files and related tests/CSS. No related runtime imports/dependency remain. The only keyboard shortcut added is Ctrl/Cmd+Enter inside the expense textarea; Fn and ordinary Enter retain their normal behavior.

A whole-repository search still finds historical delivery reports and this audit's search terms. Automatic approval rejected deleting/bulk-stripping those prior reports, so they are preserved as evidence; current README instructions were specifically updated. Runtime source has zero matches. No claim is made that archived prose contains zero mentions.

## Data model

| Table          | Scope and purpose                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| users          | Email/password hash, profile/UPI/color, optional demo expiry                                                                                                 |
| sessions       | SHA-256 token digest, user, selected group, expiry                                                                                                           |
| auth_attempts  | Persistent login/join lockout counters                                                                                                                       |
| groups         | Owner, approval setting, internal random lookup key, optional demo expiry                                                                                    |
| group_members  | Group/account, role, active/pending/removed status and joined time; unique group/account                                                                     |
| group_invites  | Random unique code, creator, expiry, usage cap/count and revocation                                                                                          |
| expenses       | Group, payer membership, integer paise, category/date/description/raw text                                                                                   |
| expense_shares | Expense/membership and integer share paise                                                                                                                   |
| payments       | Group, payer/receiver accounts, integer paise, pending/confirmed/disputed/cancelled, optional UTR/note, created/confirmed times and unique linked settlement |

PostgreSQL migrations are checked in. SQLite uses the same derived schema locally. Legacy nullable account/owner links retain existing rows safely; newly created groups/members always link accounts. Unowned legacy groups are quarantined from account access. Removal keeps old expenses, and a later pending rejoin retains those historical balances while remaining unauthorized. Parser/new expense choices include active members only.

## Protected endpoints

Only health, auth entry points and anonymous session status are public. Logout only clears/revokes the matching cookie.

Authenticated account: PATCH /api/auth/profile; GET/POST /api/groups; POST /api/groups/join.

Membership-scoped group routes: POST /api/groups/:id/select and /leave; GET /api/groups/:id/members. The same generic message covers unknown groups and outsiders.

Admin-only group routes: invite listing/creation/revocation, approval settings, approve/reject/remove members, transfer-admin and delete-group. See README for exact paths.

All selected-group endpoints verify an active database membership before resolving their service:

- GET /api/group
- POST /api/parse
- GET/POST /api/expenses and PATCH/DELETE /api/expenses/:id
- GET /api/balances, /api/settlements, /api/report
- POST /api/reminder and GET /api/wrapped
- GET/POST /api/payments, POST /api/payments/cash and POST /api/payments/:id/{confirm,dispute,cancel}
- Legacy member facade: POST rejects manual ghost members, PATCH is profile-self only, DELETE is admin-only.

Client IDs never select an unchecked ledger. Payer/share IDs must belong to the active group. Parser names are loaded from active group membership. Removed users lose access immediately; their profile changes cannot modify old group records. Group/account transitions reload private caches and guard unsaved reviews.

## Authentication and hardening

Bcrypt 12-round password hashes; random 256-bit sessions, only digests stored. Cookies are httpOnly, SameSite=Lax and production Secure/__Host-, with no Domain attribute. Tokens never go into browser storage. Seven-day normal sessions; 24-hour demo sessions. IP/email throttles and persistent short login lockouts; join IP/user throttles plus invalid-code lockouts. All model endpoints limit per user. Demo, parser, reminders and Wrapped stub behavior remain available without an API key.

Helmet, strict credential CORS, Origin checks on writes, 128KB JSON limits, Zod validation, generic JSON errors, root error boundary, loading/retry/empty states and hourly expiry cleanup are present. The seed maintenance script never creates a public group. Secrets and SQLite data are git-ignored.

## Payment correctness

UPI/QR only starts an external payment; no callback is treated as proof. The payer creates a pending claim; balances stay unchanged. The receiver checks actual receipt and confirms, or disputes. Payer can cancel pending; receiver can record cash. Dispute notices are visible to payer/admin in the bell/inbox. No email/SMS or gateway is used.

Serializable transactions revalidate active parties and available debt/credit. Pending claims reserve both sides; overpayment and stale claims fail. Confirmation creates one unique linked settlement; repeated/concurrent confirmation cannot double count. Direct repayment saves and edits/deletion of confirmed settlements are blocked. Removing a member cancels their pending claims. Rupee API values are converted to integer paise for all ledger calculations.

Test with two accounts: save a shared expense, submit I've paid from the debtor, verify unchanged balances, switch to receiver and Confirm received, verify balances reduce exactly once. Repeat confirmation, dispute/cancel another claim, try as an outsider and try an excessive amount. All are exercised by real HTTP integration tests.

## Verification record

- Frontend full run: 40/40 passed; additional active-only next-payer regression passed (3/3 targeted insight cases). Final standard-command rerun recorded below.
- Backend unit tests: 61/61 passed, including money, rounding, simplification and parser validation/retry/stub behavior. Reminder assertions check encoded receiver UPI/amount.
- Real HTTP integration: 22/22 passed across auth/demo, ledger, private groups, payments and security; latest historical-pending-rejoin regression also passed (7/7 group cases). Final full rerun recorded below.
- Root/server TypeScript: passed. ESLint: zero errors, seven existing Fast Refresh warnings.
- Production frontend/API builds: passed; Vercel preset build passed. Canonical PostgreSQL Prisma schema validation passed. SQL migrations have not been executed against a live PostgreSQL service here.
- Local same-origin proxy: GET http://127.0.0.1:8080/api/auth/me returned JSON 200 with anonymous session, rather than frontend HTML.
- Browser: Try demo created a private workspace; focused textarea, Ctrl+Enter parse, review card, explicit Save all and updated balances verified. Synthetic demo cash receipt appeared as confirmed in the inbox and removed its debt suggestion. No actual money moved. Evidence: payment-demo-qa.png.
- Earlier browser contexts A/B verified separate private demo IDs, anonymous group access 401, JavaScript-inaccessible cookie and no stored login token. Current independent HTTP cookie jars exercise two real accounts and outsider behavior.

## Two-minute demo script

| Time      | Action                                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 | Show landing Try demo; explain isolated 24-hour judge access. Use prepared real accounts Kabir and Aman in browser/incognito.                                                                                                                       |
| 0:15–0:35 | Kabir creates Flat 302, copies invite. Aman joins; show pending and blocked ledger. Kabir approves in Members.                                                                                                                                      |
| 0:35–0:55 | Kabir holds Wispr Fn in Add and dictates: Maine 600 ka dinner kiya, Aman ke saath split. Ctrl+Enter, inspect both shares, Save all.                                                                                                                 |
| 0:55–1:10 | Show Kabir +300 and Aman -300. Open a reminder tone; show editable text and UPI link.                                                                                                                                                               |
| 1:10–1:30 | Aman opens Kabir's QR/UPI. Explain actual payment happens in a UPI app. For a recording use a genuine agreed transfer or explicitly label a test ledger; never claim bank verification. Aman submits I've paid; show pending and unchanged balance. |
| 1:30–1:45 | Kabir verifies receipt and confirms. Show zero balances, happy mascot/confetti and one settlement.                                                                                                                                                  |
| 1:45–2:00 | Show Report and Wrapped; return to outsider/incognito access rejection or member removal proof.                                                                                                                                                     |

For a strict two-minute video, sign up/create the second account immediately before recording and keep its login ready; narrate signup while showing the form briefly. Set profile UPI IDs before the QR segment. Use the current month in Report/Wrapped. Samples use demo member names and must be adapted to real approved names.

## Manual checks before submission

1. Replace the explicit placeholder backend origin in vercel.json and configure Vercel/Render/Railway secrets/URLs. VITE_API_URL must be empty for same-origin proxy. CORS_ORIGIN must match the actual frontend HTTPS origin. Verify production cookie persistence/logout and Origin forwarding; direct cross-site SameSite=Lax fetches will not work.
2. Run PostgreSQL migrations against the chosen service, check backups and /health, then test two separate accounts on the deployed URL. Deployment, cloud PostgreSQL, Docker image execution and live Claude were not available/configured here.
3. Set ANTHROPIC_API_KEY, ANTHROPIC_MODEL and USE_CLAUDE_STUB=false; restart and test parse/reminder/Wrapped. Never add the key to frontend env.
4. Test real mobile UPI app opening, QR scan and bank receipt with the receiver. UTR is not verification. No bank/payment transaction was performed by the agent.
5. Record Wispr Flow dictation on your actual keyboard and test mobile layout, clipboard/WhatsApp draft permissions, Wrapped export and reduced motion.
6. No password recovery/email verification is included. Process-local request limits/caption caches assume one backend instance; add shared stores before scaling. Exact settlement minimization is bounded to 16 nonzero balances, with greedy fallback beyond that.
