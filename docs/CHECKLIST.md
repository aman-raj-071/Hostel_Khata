# Idea checklist — code audit

Statuses distinguish the audit finding from the final implementation. `DONE` means implemented and locally verified, not a claim of live Claude, microphone accuracy or deployed hosting.

| Item                                                            | Audit   | Final                       | Evidence / action                                                                                                                           |
| --------------------------------------------------------------- | ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| One paragraph → multiple expenses                               | PARTIAL | DONE (Part B)               | `server/src/stub.ts` only split lines/“aur phir”; `server/prompts/parsePrompt.ts` supports full real parsing                                |
| WhatsApp sender lines, timestamps and noise                     | PARTIAL | DONE (Part B)               | `server/src/stub.ts` timestamp colon could become the sender/amount                                                                         |
| Hinglish numbers, k, kal/parso, baaki/udhaar                    | PARTIAL | DONE (Part B)               | Common numbers existed; ambiguous/debt wording needed conservative handling                                                                 |
| Equal/subsets/exclusions/exact/percent                          | PARTIAL | DONE (Part B)               | `server/src/parser.ts`, `money.ts`; stub only emitted equal/settlement exact                                                                |
| Itemized splits                                                 | PARTIAL | DONE (Part B)               | Prompt and validated shares exist; add deterministic item fixtures and missing-price questions                                              |
| Settlement-type entries                                         | DONE    | DONE                        | `server/src/stub.ts`, `parser.ts`, `service.ts`; exact receiver shares and repayments                                                       |
| Editable explicit confirmation, never autosave                  | DONE    | DONE                        | `src/routes/review.tsx`, `src/lib/draft.ts`, `server/src/service.ts`; browser parse/discard made no DB entry                                |
| Yellow clarification, no invented members/amounts               | PARTIAL | DONE (Part B)               | `parser.ts` retains uncertain entries; stub must reject ambiguous numeric alternatives                                                      |
| Fuzzy names and exact share sums, payer rounding                | PARTIAL | DONE (Part B)               | `parser.ts`, `money.ts`; share validation exists, participant/exclusion matching in stub needed reuse                                       |
| Shared Zod pipeline + retry once for stub/Claude                | DONE    | DONE                        | `server/src/parser.ts`, `src/lib/contracts.ts`, `server/src/parser.test.ts`                                                                 |
| Balances avatars and debt-flow arrows                           | DONE    | DONE                        | `src/routes/balances.tsx`; browser route walk                                                                                               |
| Minimum-payment simplification                                  | PARTIAL | DONE (Part B)               | `server/src/money.ts` was a greedy heuristic, not globally optimal                                                                          |
| UPI link, QR and missing-ID copy fallback                       | DONE    | DONE                        | `src/routes/settle.tsx`, `src/lib/format.ts`; QR browser-tested without initiating payment                                                  |
| History search/member filter/edit/confirmed delete              | DONE    | DONE                        | `src/routes/history.tsx`, `components/ExpenseEditSheet.tsx`, HTTP integration tests                                                         |
| Members and UPI IDs                                             | DONE    | DONE                        | `src/routes/members.tsx`; browser and CRUD checks                                                                                           |
| Monthly donut, paid/share chart, WhatsApp summary               | DONE    | DONE                        | `src/routes/report.tsx`, `server/src/service.ts`                                                                                            |
| Recurring WiFi/doodh/gas templates                              | MISSING | DONE (Part B)               | Add one-tap review previews; preserve confirmation                                                                                          |
| Four reminder tones, WhatsApp draft and Copy                    | DONE    | DONE                        | `components/ReminderSheet.tsx`, `server/src/reminder.ts`; tone speech command browser-tested                                                |
| Wrapped stories, computed awards, cached captions, PNG          | DONE    | DONE                        | `routes/wrapped.tsx`, `server/src/wrapped.ts`; actual browser PNG rendering verified                                                        |
| Reactive mascot, count-up, settled confetti                     | DONE    | DONE                        | `components/KhataMascot.tsx`, `Money.tsx`, `States.tsx`, `styles.css`                                                                       |
| Full-site voice                                                 | PARTIAL | DONE (Part A)               | `lib/voice.ts`, `components/VoiceControl.tsx`, `hooks/use-speech-recognition.ts`; regression table and browser evidence in `REGRESSIONS.md` |
| Optional bill/screenshot vision                                 | MISSING | MISSING — optional deferred | Upload/privacy/line-item validation adds risk; use typed/spoken itemized input within the deadline                                          |
| Flat 302 / five members / ~25 entries over 30 days / no login   | DONE    | DONE                        | `server/prisma/seed.ts`; idempotent seed tests preserve existing data                                                                       |
| Twenty-message chat sample                                      | DONE    | DONE                        | `samples/chat.txt`                                                                                                                          |
| Stub for every LLM endpoint; clear missing-key JSON             | DONE    | DONE                        | `server/src/parser.ts`, `reminder.ts`, `wrapped.ts`, unit/HTTP tests                                                                        |
| Health, env CORS, LLM rate limits                               | DONE    | DONE                        | `server/src/app.ts`, `server/.env.example`                                                                                                  |
| Env examples, ignored secrets, no committed env files           | DONE    | DONE                        | `.env.example`, `server/.env.example`, `.gitignore`; tracked-file check                                                                     |
| Loading/empty/error states                                      | DONE    | DONE                        | `components/States.tsx`, all route components, API request errors, error/retry tests                                                        |
| README: problem/users/features/setup/env/Wispr/URL placeholders | DONE    | DONE                        | `README.md`; describes a reproducible Wispr workflow, not unverified usage statistics                                                       |
| Vercel + Render/Railway config, migrations/seed                 | DONE    | DONE                        | `vercel.json`, `vite.config.ts`, `render.yaml`, `server/Dockerfile`, README; hosting not published                                          |

## Known interpretation limits

- Unsupported embedded browsers cannot acquire SpeechRecognition by changing React code. Native Chrome was supported in the browser test; unsupported browsers retain Wispr/text input.
- Voice testing injected final recognition events; actual speech service/network/permission/audio accuracy needs a human microphone check.
- WhatsApp opens an editable draft and UPI opens the user's own app. No test sent an external message or initiated a transfer.

## Part B verification

- Stub regression tests: `server/src/stub.test.ts` cover paragraphs, timestamp stripping, chat continuations/noise, word amounts, exact/percent/itemized splits and unknown/ambiguous input. Same shared validator/retry as real Claude.
- Recurring previews: `src/lib/templates.ts`, `templates.test.ts`, `components/RecurringTemplates.tsx`; browser verified latest WiFi amount, today date, yellow confirmation and disabled Save all.
- Minimum-payment optimizer: `server/src/money.ts`, `money.test.ts`; exact up to 16 nonzero balances, bounded greedy fallback above that (not globally optimal).

Part B final checks: frontend 85/85 (fork pool on Windows), backend 60/60, real HTTP/SQLite integration 6/6, root TypeScript and server build passed, lint 0 errors / 7 existing Fast Refresh warnings, production frontend+backend build passed. Browser: three-expense paragraph review and repeat WiFi preview; both discarded without saving. Seed subprocess startup allowance raised to 60 seconds for this machine; assertions unchanged.
