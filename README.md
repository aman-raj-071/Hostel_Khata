# Hostel Khata

Private expense splitting for hostel and flatmate groups in India. Dictate a Hinglish paragraph with **Wispr Flow**, check the parsed cards, save, see balances and settle directly through UPI. The app keeps the existing Lovable React/TypeScript/Tailwind design and uses TanStack Start, Express, Prisma and Zod.

**Try demo** on the landing/login pages opens an isolated Flat 302 group with Kabir, Aman, Riya, Dev and Sneha and 25 realistic expenses over 30 days. Each demo expires after 24 hours; fictitious UPI addresses must never receive real money. No signup or Claude key is needed in stub mode.

## Core flow

1. Sign up, create a private group, share its invite code/link.
2. A second account joins; approval is on by default. Admin approves in Members.
3. On Add, hold Fn using Wispr Flow and dictate into the large focused text field, or paste WhatsApp chat. The app receives ordinary text and never intercepts Fn. Ctrl/Cmd+Enter parses; Enter inserts a newline.
4. Review every card, resolve questions and press Save all. Parsing never persists expenses.
5. Check Balances / Settle. Scan the receiver QR (primary on desktop) or open their UPI link on mobile.
6. Payer submits **I've paid**, optionally with UTR. Receiver verifies actual receipt, then **Confirm received**. Only then does the ledger change.

Features also include expense history/editing, equal/exact/percent/itemized splits, recurring bill drafts, who-should-pay-next, four editable reminder tones with receiver UPI links, monthly WhatsApp reports, and Hostel Wrapped stories/PNG export. WhatsApp opens a draft; it never sends automatically.

Wispr Flow is the only dictation layer. No browser audio controls or command parser remain in runtime source. The app cannot prove whether text was dictated; record your own Wispr use for the challenge. Historical delivery reports remain archived as prior evidence, not current instructions.

## Local setup

Node 22.12+ and npm are required. From the repository root:

```sh
npm install
cp .env.example .env
cp server/.env.example server/.env
npm run setup:server
npm run dev
```

On PowerShell use Copy-Item in place of cp. The single dev command starts frontend and API together. Frontend: http://127.0.0.1:8080. API: http://127.0.0.1:3001. Health: http://127.0.0.1:3001/health.

The example configuration uses SQLite and USE_CLAUDE_STUB=true, so it needs no cloud account. Setup generates Prisma and creates tables. The seed command only cleans expired demo accounts; it never creates a shared public group. Try demo creates sample data at request time. Existing legacy data is preserved and not assigned to new accounts.

For local PostgreSQL, run docker compose up -d db, set DATABASE_URL=postgresql://hostel:hostel_local@127.0.0.1:5432/hostel_khata and rerun setup:server. Canonical schema and PostgreSQL migrations are in server/prisma. SQLite derives the same model into schema.sqlite.prisma and uses db push for local development. Changing providers requires db:generate and does not move data between databases. The member-table rename preserves local IDs and foreign keys. Back up production data before migrations.

## Environment

Keep server/.env git-ignored. Never add a secret to VITE variables or post credentials in chat.

| Variable          | Where       | Value / purpose                                                                 |
| ----------------- | ----------- | ------------------------------------------------------------------------------- |
| VITE_API_URL      | Frontend    | Empty for same-origin /api proxy; optional API origin for same-site development |
| DATABASE_URL      | Server      | file:./dev.db locally; PostgreSQL URL in production                             |
| DIRECT_URL        | Server      | Optional unpooled PostgreSQL migration connection                               |
| ANTHROPIC_API_KEY | Server only | Your Claude API key                                                             |
| ANTHROPIC_MODEL   | Server only | A model enabled for your account                                                |
| USE_CLAUDE_STUB   | Server      | true for deterministic local parsing/reminders/Wrapped; false for real Claude   |
| NODE_ENV          | Server      | development locally; production enables Secure cookies and HSTS                 |
| PORT              | Server      | 3001 locally; deployment platform may provide it                                |
| CORS_ORIGIN       | Server      | Exact comma-separated frontend origins, including scheme; no wildcard           |
| TRUST_PROXY_HOPS  | Server      | 0 direct locally; deployment's verified proxy hop count (usually 1)             |

To switch to real Claude: put key/model into server/.env, set USE_CLAUDE_STUB=false and restart the API. Test parse, reminder and Wrapped. A missing key returns a clear JSON error. Both parser paths use the same Zod validation, retry-once, fuzzy-member matching and paise share-sum checks. The user-supplied system prompt is preserved in server/prompts/parsePrompt.ts; temperature is 0.2 or lower.

## Accounts and privacy

Passwords use bcrypt with 12 rounds. Random 256-bit session cookies are httpOnly, SameSite=Lax and Secure in production with the __Host- prefix. Only SHA-256 session digests are stored in the database; no token enters localStorage. Logout revokes the session. Normal sessions expire in seven days; demo sessions in 24 hours. Hourly/startup cleanup removes expired demo data, expired sessions and old lockout counters.

Signup/login have per-IP and per-email throttles and persistent short lockouts after repeated failures. Login failure messages do not reveal whether an email exists. Email/password accounts are self-contained: email verification and password recovery are not implemented.

Every non-public app endpoint requires a valid session. Ledger scope comes from the session's selected group plus an **active database membership**, never an unchecked client group ID. Pending and removed members cannot use the group. Unknown/inaccessible groups return the same generic error. New payers and shares must be active members in that group. Removed-member history is retained; profile edits do not alter former memberships.

Invites use a cryptographically random 10-character unambiguous code (50 bits), expiry, optional usage cap, revocation and rotation. Join attempts have per-user/IP limits and persistent invalid-code lockouts. A pending request consumes one invite use; retrying it does not consume another. Default expiry is seven days; configurable up to 90 days. Admins approve/reject/remove, configure approval, transfer admin and delete. Leaving requires a zero balance; a last admin must transfer or delete. Group changes reload private query/draft state and block unsaved reviews.

Helmet, credential CORS, Origin checks on writes, 128KB JSON limits, Zod input/response contracts and generic production errors are enabled. Parse/reminder allow ten requests/minute/account; Wrapped allows twenty. IP/demo limits and the Wrapped caption cache are process-local; use a shared rate-limit/cache store before horizontal scaling. Persistent account/join lockouts already use the database.

## Payments

Money moves directly between UPI apps; Hostel Khata is a ledger, not a gateway. UPI links and QR encode receiver VPA/name, exact rupees, INR and Hostel Khata note. No UPI callback is trusted as proof. UTR is optional user-entered metadata.

Only a payer can create their own pending claim. Only the receiver can confirm/dispute it; only the payer can cancel pending. A receiver can record cash actually received. Pending/disputed/cancelled records do not change balances. Confirmation atomically creates one linked settlement and is idempotent, including concurrent requests. Pending claims reserve available debt/credit; stale or excessive amounts fail. Confirmed payment ledger entries cannot be edited/deleted through expense CRUD. Direct Settlement imports are rejected and redirected to the two-sided flow. Group deletion removes the whole scoped ledger after confirmation in the UI.

The bell counts incoming receipts and dispute notices for payer/admin; the group inbox shows payment history. Balances, settlements and payment records refresh every 15 seconds. No email/SMS or paid service is needed. Razorpay is intentionally excluded. See docs/PAYMENTS.md.

All stored amounts are integer paise. API amounts are rupees. Net balance is paid minus owed, including confirmed settlements. Equal splits assign leftover paise to the payer; for a non-divisible equal split the payer must participate, otherwise use an exact split. Simplification uses exact minimum-payment partitioning for up to 16 nonzero balances, then a bounded greedy fallback. Reports include repayments; Wrapped spending awards exclude them. Wrapped captions have a bounded process-local cache invalidated when facts change.

## API

Public: GET /health; POST /api/auth/signup, /login, /demo; GET /api/auth/me; POST /api/auth/logout (revokes any matching cookie).

Authenticated account: PATCH /api/auth/profile; GET/POST /api/groups; POST /api/groups/join.

Verified membership on the requested group: POST /api/groups/:id/select, /leave; GET /api/groups/:id/members. Admin only: GET/POST /api/groups/:id/invites; DELETE /api/groups/:id/invites/:inviteId; PATCH /api/groups/:id/settings; POST /api/groups/:id/members/:memberId/approve or /reject; DELETE /api/groups/:id/members/:memberId; POST /api/groups/:id/transfer-admin; DELETE /api/groups/:id.

Active selected-group membership on every endpoint below:

- GET /api/group
- POST /api/parse
- GET/POST /api/expenses; PATCH/DELETE /api/expenses/:id
- GET /api/balances, /api/settlements, /api/report?month=YYYY-MM
- POST /api/reminder; GET /api/wrapped?month=YYYY-MM
- GET/POST /api/payments; POST /api/payments/cash; POST /api/payments/:id/confirm, /dispute, /cancel
- PATCH /api/members/:id is profile-self only; DELETE is admin-only. Legacy POST /api/members returns an invite-required error.

Errors are always { error: string }. src/lib/api.ts is the sole frontend HTTP boundary; shared contracts/types are validated at the boundary. No component imports demo fixtures.

## Checks

```sh
npx tsc --noEmit
npm run lint
npm test
npm run test:integration
npm run build:all
```

Frontend tests default to a single fork worker for Windows reliability. If the host interrupts a run, run the affected file directly. Integration tests start real Express servers and use the configured development DB; they create isolated fixtures and remove their own records. Use a disposable local database, never the production connection. Authorization tests exercise each ledger/group route with outsiders, pending/removed members and exhausted/expired/revoked invites. Payment tests include receiver permissions, reservation/overpayment, concurrent confirmation, cash and ledger effects. Security tests cover production cookies/headers, CSRF, body limits and per-account LLM throttles.

## Deployment: Vercel + Render / Railway

No live deployment has been made from this workspace. Configure the hosting accounts and URLs before publishing.

1. Provision PostgreSQL on Supabase/Neon/your platform. Set server variables above, NODE_ENV=production, correct CORS_ORIGIN and TRUST_PROXY_HOPS. Deploy the repository Dockerfile server/Dockerfile with repository-root context, or build with npm --prefix server ci and npm --prefix server run build; start with npm --prefix server start. Run npm --prefix server run db:migrate as a release/predeploy command. Do not run a shared seed. Render blueprint is render.yaml; Railway can use the same Dockerfile/start command. Check backend /health.
2. In Vercel environment variables set API_ORIGIN to the actual HTTPS backend origin without a trailing slash (for example https://your-api.onrender.com). Leave VITE_API_URL empty and deploy the repository root; VERCEL selects Nitro's Vercel preset. Nitro generates the same-origin /api proxy in its Vercel output. A missing API_ORIGIN stops the build with an actionable error. Install/build commands are supplied. The browser now sees frontend and API on one origin; Set-Cookie has no Domain attribute and the Secure __Host- cookie belongs to the frontend host. The Express backend is a separate service; deploying the frontend alone does not deploy it.
3. Set backend CORS_ORIGIN to the exact Vercel/custom frontend origin. Add specific preview origins only if needed; never wildcard credentials. Keep Origin unchanged through a proxy. Verify signup, refresh persistence and logout over HTTPS. Forwarding only through the same-origin proxy avoids cross-site third-party-cookie failures with Vercel + Render. A direct cross-site API URL will fail with SameSite=Lax; use the rewrite rather than weakening cookies. Same-site custom subdomains are another option with exact CORS and credentials.
4. Test **two separate accounts**, browser and incognito, on the deployed URL: outsider blocked, pending blocked, approval enables access, removal revokes access; parse/review/save, QR/UPI, pending claim and receiver confirmation. Never claim bank receipt unless it actually happened. Test mobile UPI app opening and desktop QR manually.

The Render predeploy feature may depend on plan availability; if absent run the migration through its release shell before directing traffic. Keep DATABASE_URL server-only. Never generate a client with SQLite for a PostgreSQL deployment; the Docker build generates the canonical PostgreSQL client.

For a public site, disable Vercel Authentication under the project's Deployment Protection settings for the intended production deployment. Otherwise visitors are redirected to Vercel sign-in before reaching the app. Redeploy after changing build environment variables.

Locally, port 8080 is fixed because the API's allowed origins include that port. If startup reports it is occupied, stop the previous dev server and run npm run dev again; the frontend intentionally does not move to another port. Non-Vercel production builds use Nitro's Node server preset.

## Netlify deployment

The repository includes netlify.toml. It runs npm run build:netlify, publishes dist, and deploys the existing Express API as a Netlify Function alongside Nitro's frontend function. Netlify Database automatically provisions PostgreSQL and applies the existing SQL migrations in server/prisma/migrations. The API uses the deployment's database connection; local SQLite data is not uploaded. Leave VITE_API_URL and API_ORIGIN empty. Set CORS_ORIGIN to the exact HTTPS site origin, TRUST_PROXY_HOPS=1, and USE_CLAUDE_STUB=true for parsing without an Anthropic key. To enable real Claude, configure the server-only key/model and set the stub flag to false. Deploy with netlify deploy --prod --build after authenticating and linking the intended site.

## Submission

See docs/SECURITY_REPORT.md for audit evidence, model/protected endpoints, test results, a two-minute demo script and manual checks. samples/chat.txt uses demo names; for a real private group use its actual approved member names. Historical reports describe earlier implementations and are retained unchanged as delivery evidence.
