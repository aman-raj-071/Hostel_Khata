# Phase 5: demo and deployment readiness

- Expanded the idempotent seed to 25 expenses across the last 30 days. Existing demo entries are recognized by raw text; stable IDs prevent duplicate new rows. Member settings and existing expenses are not overwritten. The dataset includes old net dues, chai, a big dinner, WiFi and gas.
- Added `samples/chat.txt` with 20 realistic dated WhatsApp messages. Update dates before a later-month demo.
- Kept the existing robust **POST** `/api/parse`: shared validation, retry once, fuzzy matching, shares checks and explicit clarification/confirmation. The brief's later reference to GET is inconsistent with its request body; existing POST clients are preserved.
- Health, CORS, per-IP LLM rate limits, combined `npm run dev`, Vercel frontend configuration, server Docker/Render/Railway deployment instructions, migration and seed commands remain in place. Reminder and Wrapped require no new secrets beyond existing Anthropic settings.
- README now explains the problem, features, Wispr Flow workflow, Wrapped semantics/cache, reminder editing/sharing, deployment URL placeholders and setup. Deployment is prepared, not published; no hosting account access or real Claude credentials were supplied.

## Verification status

- 54 frontend tests passed (52 existing/reminder/voice tests plus 2 Wrapped story/export-wiring tests); 42 backend unit tests passed.
- Six real HTTP/SQLite integration tests passed, including reminder validation/throttling, Wrapped caching, the complete financial flow, group boundaries and running the expanded seed twice without duplicates or overwriting UPI settings.
- Frontend and backend TypeScript passed. Full lint passed with zero errors and seven existing Fast Refresh warnings. `npm run build:all` passed for client, SSR, Prisma generation and the server.
- `html-to-image` 1.11.13 is installed and pinned in `package-lock.json`; Vercel explicitly uses `npm ci`. Render's pre-deploy command runs migrations and the idempotent seed. The local demo was extended to 25 entries without replacing existing data.
- Browser visual QA, actual microphone hardware, actual PNG rendering, real Claude, cloud PostgreSQL and hosted deployment remain unverified. PNG wiring is tested with a mocked renderer; cache is process-local. Deployment is prepared, not published. Existing large-client-chunk warnings remain.
