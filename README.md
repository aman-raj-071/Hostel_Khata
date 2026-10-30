# Hostel Khata

For hostel and flatmate groups who lose shared chai, food, bills and repayments in chat noise. Speak a Hinglish expense, review the split and confirm it; see balances without login. Includes WhatsApp imports, voice navigation, paise rounding, UPI/QR, four reminder tones, reports and shareable Hostel Wrapped stories.

Deployed frontend: **YOUR_VERCEL_URL**. Backend: **YOUR_RENDER_OR_RAILWAY_URL**. These are placeholders, not live deployments.

Wispr Flow can dictate into the expense textarea, coding prompts, docs and commit-message fields. In-app voice uses browser SpeechRecognition; Wispr Flow remains the text-input fallback. Record your own use for the challenge: the app cannot verify which keyboard input was dictated.

The expanded seed has 25 expenses over 30 days, including old net dues, chai, a big dinner, gas and WiFi. It adds missing demo entries without overwriting existing expenses, member settings or UPI IDs. `samples/chat.txt` contains 20 dated import examples; change dates for your demo month if needed.

**Wrapped:** `/wrapped` has swipeable stories, awards and PNG export. `GET /api/wrapped?month=YYYY-MM` returns `{ total, awards, biggestExpense }`. Awards are computed in code; one Claude call supplies captions, or deterministic stub captions are used. Repayments affect net dues but not spending awards. Debt age uses FIFO net dues. A bounded process-local group/month cache invalidates on changed facts; restarts clear it and multiple instances need shared persistence.

**Hands-free:** “wrapped dikhao”, “settle up kholo”, “reminder bhejo”, “haan theek hai” extend existing commands. Multiple reminders require the displayed button number. Unsupported browsers hide the mic and retain typed/Wispr input. Dictation treats commands as text until “likhna band”; saving and UPI payments still require confirmation.

**Reminder tones:** on Settle, choose Send reminder → polite / filmy / mummy / savage → edit → Copy or Send on WhatsApp. WhatsApp opens a draft and lets you pick the recipient; no message is sent automatically. `POST /api/reminder` accepts `{ fromId, toId, amount, tone }`, returns `{ message }`, and permits 10 requests/minute/IP. Both members must be in the configured group, different, and the amount positive with at most two decimals. Missing UPI IDs prompt the creditor to share one. Stub mode has two deterministic variants per tone; Generate again returns the same text for the same payment/tone. Disable the stub and set the existing server key/model variables for real Claude. Wrapped is limited to 20 requests/minute/IP.

Voice-first Hinglish expense splitting for a public demo group. The existing Lovable React/TypeScript/Tailwind frontend uses TanStack Start. `src/lib/api.ts` calls an Express API in `server/`; shared types remain in `src/lib/types.ts` and Zod contracts are in `src/lib/contracts.ts`.

## Local setup

Use Node **22.12+**, npm and optionally Docker. From the repository root:

```sh
npm install
cp .env.example .env
cp server/.env.example server/.env
npm run setup:server
npm run dev
```

PowerShell also supports `Copy-Item` instead of `cp`. The setup command installs backend packages, generates Prisma Client, initializes the database and seeds Flat 302 with Kabir, Aman, Riya, Dev, Sneha and 25 expenses over the last 30 days. Re-running seed adds missing demo entries while preserving existing data. Seed UPI IDs are examples, **not verified payment addresses**.

Frontend: <http://127.0.0.1:8080>. API: <http://127.0.0.1:3001>. Database health: <http://127.0.0.1:3001/health>.

The example server env uses SQLite and a deterministic Claude stub; no cloud account or key is needed. `npm run dev` starts both processes and stops both if either fails. `npm run dev:web` starts just the frontend. Backend scripts run with `server/` as their working directory.

### PostgreSQL locally

```sh
docker compose up -d db
```

Set `server/.env` to `DATABASE_URL=postgresql://hostel:hostel_local@127.0.0.1:5432/hostel_khata`, then run `npm run setup:server` again.

`server/prisma/schema.prisma` is the canonical PostgreSQL schema, with checked-in SQL migrations under `server/prisma/migrations`. SQLite uses a generated `schema.sqlite.prisma` derived from the same schema and `prisma db push` for local development; it does not use PostgreSQL migration history. Switching providers requires generating the client again and does not transfer existing data. No destructive reset or production seed runs automatically at API startup.

## Environment

Frontend `.env` is public and compiled at build time:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin, e.g. `http://127.0.0.1:3001` or your HTTPS backend origin; omit `/api` |

Server `server/.env` is ignored by Git:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL URL, or `file:./dev.db` locally, relative to `server/` |
| `DIRECT_URL` | Optional direct/unpooled PostgreSQL URL for migrations; runtime uses `DATABASE_URL` |
| `ANTHROPIC_API_KEY` | Server-only secret; never use a `VITE_` prefix |
| `ANTHROPIC_MODEL` | A Claude model ID enabled for your account |
| `USE_CLAUDE_STUB` | Exactly `true` enables offline fixtures; `false` calls Claude |
| `PORT` | API port, default `3001` |
| `CORS_ORIGIN` | Comma-separated frontend origins without trailing slashes |
| `GROUP_CODE` | Server-selected demo group, default `flat-302` |
| `TRUST_PROXY_HOPS` | `0` locally; set the verified reverse-proxy hop count on your host |

### Switch to real Claude

1. Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in the server environment.
2. Set `USE_CLAUDE_STUB=false` and restart the API.
3. Parse a short sentence, review the payer/participants, then save it.

Without a key and with the stub off, parsing returns 503 and exactly `{ "error": "ANTHROPIC_API_KEY not configured" }`. Stub mode never instantiates the Anthropic client. Both paths use the same Zod validation, fuzzy member resolution, sum checks and retry-once pipeline. The user-supplied prompt is stored verbatim in `server/prompts/parsePrompt.ts`. `PARSE_SYSTEM_PROMPT` is the system prompt and `buildParseUserMessage` constructs the single user message. Temperature is 0. Names come from the DB and dates use Asia/Kolkata. Parse persists nothing.

The stub covers common keyword amounts, named payers, exclusions, chat senders and repayments. It is not a substitute for Claude's complex percentages, itemized orders or arbitrary Hinglish. Unknown amounts remain visible as 0 with clarification required; saving rejects them. Only unique close name matches are accepted; arbitrary nicknames need review. Real parsing sends the submitted text and member names to Anthropic, so avoid submitting unrelated private chat history.

## REST API

Errors consistently return `{ "error": "friendly message" }`. Zod validates requests and responses, including the frontend HTTP boundary. Status codes: invalid input 400, unknown records 404, data conflicts 409, unresolved/invalid splits 422, throttling 429, upstream Claude failure 502, missing parser configuration 503 and internal failure 500.

| Method | Endpoint | Input / result |
| --- | --- | --- |
| GET | `/health` | Checks database connectivity |
| GET | `/api/group` | `{ id, name, members }` |
| POST | `/api/parse` | `{ text, mode, speaker? }` → `{ expenses: ParsedExpense[] }` |
| POST | `/api/expenses` | `{ expenses: ParsedExpense[], rawText? }` → `Expense[]` |
| GET | `/api/expenses` | Optional `memberId`, `q` (description/payer), `month=YYYY-MM` |
| PATCH | `/api/expenses/:id` | `Partial<Expense>`; merged record must balance |
| DELETE | `/api/expenses/:id` | 204 |
| GET | `/api/balances` | `Balance[]` |
| GET | `/api/settlements` | `Settlement[]` |
| GET | `/api/report` | `month=YYYY-MM`; defaults to current India month |
| POST | `/api/members` | `{ name, upiId? }` |
| PATCH | `/api/members/:id` | `Partial<Member>` |
| DELETE | `/api/members/:id` | 204; refuses removal if referenced by expenses |

The frontend retains `parseText(text, mode)`, so sends no explicit speaker. First-person statements without a chat sender need payer confirmation. The REST endpoint accepts `speaker` for other clients. The original parsed input is preserved as `rawText` when confirmed. Shares in `ParsedExpense` always represent rupee amounts, including percent/itemized splits.

DB money uses integer paise. Shares must total the amount exactly and reference unique members in this group. Equal splits floor the base share and give leftover paise to the payer. If the payer is excluded and there is a remainder, include the payer or choose an exact split; the server never silently adds participants. Saving a batch is atomic. Foreign keys protect referenced members.

Net = paid minus shares, including repayments. Greedy settlements repeatedly match the largest remaining debtor and creditor and preserve every paise. Greedy reduces transfers but does not guarantee a global minimum. Repayments are ordinary expenses with description `Settlement`, category `other`, and a single recipient share. “Record payment” requires confirmation; opening UPI or a QR does not prove payment. Repayments can be edited/deleted in History. Reports include repayments in totals and explicitly say so in the shareable summary.

There is intentionally no auth. Anyone with API access can read/edit the public group, including its UPI IDs. CORS is not authentication. Use demo data. Parsing is limited to 10 requests/minute/IP with an in-process store; use a shared limiter if deploying multiple replicas. JSON bodies are capped at 128 KiB and parse text at 20,000 characters.

## Voice control

Every page has a **Start voice** toolbar. Choose English/Hinglish (`en-IN`) or Hindi (`hi-IN`), then press Start and allow the browser microphone prompt. No microphone access starts automatically. Use a browser with Web Speech recognition support (typically Chrome or Edge); if unavailable, the toolbar shows an explanation and typing/Wispr Flow remain available. HTTPS or localhost is required. Browser recognition may use a remote speech service and need internet; this feature is not guaranteed to work offline. Audio is handled by the browser, not sent to the Express API; only confirmed text reaches the existing parser.

While listening, numbered badges identify the page's fields, buttons, tabs, links and dropdown options. Existing app validation and confirmation dialogs still apply.

| Say | Action |
| --- | --- |
| `add kholo`, `balances kholo`, `settle kholo`, `history kholo`, `report kholo`, `members kholo`, `review kholo` | Open that page |
| `बैलेंस दिखाओ`, `रिपोर्ट खोलो` | Hindi navigation |
| `click 5`, `button five`, `बटन पांच` | Activate/focus numbered control 5 |
| `click Paid by`, then `click 7` | Open a dropdown, then select its numbered option |
| `likho Kabir ne dinner 500 kiya` | Replace the focused field, or the only text field |
| `likhna shuru` → expense sentences → `likhna band` | Dictate into the selected text field, then return to command mode |
| `parse karo`, `save karo` | Use the existing Parse or Save action; ambiguous buttons require a number |
| `confirm`, `cancel` | Confirm/cancel the currently displayed app dialog; nothing is silently confirmed |
| `search chai` | Search the History page |
| `neeche jao`, `upar jao` | Scroll the page or open scrollable dialog |
| `mic band`, `stop listening` | Release the microphone |
| `help` | Show/hide the command guide |

For number/date fields use complete values: `likho 500.50`, or `likho 2026 dash 10 dash 29`. UPI fields understand `aman dot raj at ybl`; always check the recognized value before saving. Controls with the same label must be selected by number. In dictation mode, phrases such as "save karo" become text until you say "likhna band". Changing pages, hiding the tab or pressing Stop ends dictation; hiding the tab/unmounting also stops microphone capture. Permission, connection and unsupported-language failures show a message rather than repeatedly requesting access.

Example: `add kholo` → `likhna shuru` → `Kabir ne dinner 600 kiya Aman aur Riya ke saath` → `likhna band` → `parse karo` → review/correct with numbered controls → `save karo`. Start voice must be pressed once per session because browser microphone access needs permission. UPI payment confirmation still happens in your payment app, outside this website. The offline Claude stub remains a limited keyword parser; real Claude is recommended for natural Hindi/Hinglish expense interpretation.

Voice tests simulate recognition results without opening a real microphone and cover navigation, dictation, React input updates, disabled/ambiguous controls, confirmation, permission failures and capture cleanup. Actual recognition accuracy depends on your browser, microphone and speech service. See [MDN's SpeechRecognition documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

## Verification

```sh
npm test
npx tsc --noEmit
npm --prefix server run build
npm run test:integration
npm run build
```

Unit tests cover paise conversion/rounding, 3–5 member settlements, tiny balances, everyone settled, a single creditor, circular debt, repayments, fuzzy/ambiguous names, invalid model output and retry feedback, stub/key behavior and frontend HTTP failures. Integration tests use a real DB and HTTP for parse → confirm → save → edit → balances → repayment → all settled → report, plus CRUD validation, isolation, rollback, CORS, malformed JSON and throttling. They create/delete only uniquely named test groups, leaving Flat 302 intact. Generate/initialize the DB before integration tests.

## Deployment

### Frontend on Vercel

This is TanStack Start, not a static SPA. Vite selects Nitro's `vercel` preset when Vercel sets `VERCEL`; `vercel.json` uses `npm run build`. Deploy the repository root with Node 22. Set `VITE_API_URL` to the public HTTPS API origin and rebuild. Nitro emits Vercel Build Output including the server-rendered frontend. Keep Anthropic/database secrets out of frontend env vars.

### Backend on Render or Railway

Use Supabase/Neon PostgreSQL and the provider's SSL connection URL. Use a pooled runtime `DATABASE_URL` and direct `DIRECT_URL` for migrations if your provider requires it.

Docker context: repository root. Dockerfile: `server/Dockerfile`. It includes the shared contracts/types. `render.yaml` supplies a blueprint, `/health` and a pre-deploy migration command. On Railway select this Dockerfile and use pre-deploy `npm run db:migrate && npm run db:seed` inside `/app/server`. The image starts with `npm start`, listening on `0.0.0.0:$PORT`.

Without Docker, from the repo root:

```sh
npm --prefix server ci
npm --prefix server run build
npm --prefix server run db:migrate
npm --prefix server start
```

Set `DATABASE_URL`, optional `DIRECT_URL`, `CORS_ORIGIN` to your frontend origin, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `USE_CLAUDE_STUB=false`, and the correct `TRUST_PROXY_HOPS`. Run `npm run db:seed` once in `/app/server`, or `npm --prefix server run db:seed` outside Docker. `/health` should return `{ "status": "ok" }`. Do not deploy local SQLite files; containers use PostgreSQL persistence. Hosted deployment and live Claude require your own account configuration.

Continue UI work in the [Lovable project](https://lovable.dev/projects/7f5ab845-09df-430a-9a76-a62b56b5b7d9). Avoid rewriting published history because pushed commits sync with Lovable.
