# Step 0 audit and Phase 1

## Audit before implementation

- Existing stack: React 19, TanStack Start/Router, Tailwind 4, Radix components, React Query; Express/Prisma backend with PostgreSQL migrations and local SQLite, seeded Flat 302, server-only Claude parser and deterministic stub.
- Existing routes: `/`, `/review`, `/balances`, `/settle`, `/history`, `/report`, `/members`; root includes routing and request error boundaries.
- Existing API functions, unchanged: `getGroup`, `addMember`, `updateMember`, `removeMember`, `parseText`, `saveExpenses`, `listExpenses`, `updateExpense`, `deleteExpense`, `getBalances`, `getSettlements`, `getReport`.
- Existing voice: navigation, numbered actions, editing, dictation, dropdown selection, scrolling and explicit confirmation. Existing financial flow: parse without persistence, review, confirmed save, balances, greedy settlement, UPI/QR, confirmed repayment, monthly report.
- Gaps: light-first green palette, narrow desktop layout, no voice hero, shared member colors, count-up amounts, mascot, settled celebration or debt flow diagram. Clipboard failures in report/settle were unhandled. Members had no empty state.
- Plan: update shared tokens/shell; reuse the existing recognition session for the hero; add presentation components; preserve API contracts and confirmation; check types, lint, tests and build. Reminders and Wrapped belong to later phases.

## Phase 1 verification

- Open Add: huge mic starts expense dictation; say an expense, then “likhna band”, “parse karo”. Review before Save all; clarification must be confirmed first.
- Check Balances: stable member colors, mint/coral amounts, arrows weighted by amount; Settle retains UPI/QR and explicit record-payment confirmation.
- Theme toggle persists locally when storage is available. Dark is the default; fonts fall back to system fonts if Google Fonts is unavailable.
- Enable reduced motion: no entrance/waveform/confetti animation or number count-up. All buttons remain usable by keyboard.
- Existing backend, paise arithmetic, seeded data and Claude configuration are untouched. The waveform indicates listening, not microphone amplitude.

## Recorded checks

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, zero errors; seven existing Fast Refresh warnings in components that also export helpers.
- `npx vitest run`: 45 frontend tests passed, including hero dictation, confirmation separation, reduced motion and theme/storage behavior.
- `npm --prefix server test`: 23 backend tests passed.
- `npm run build`: client, SSR and production output passed; final bundle contains the hero member strip. The existing large-client-chunk warning remains.
- Local combined dev command serves the frontend at `http://127.0.0.1:8080/`; `/health`, `/api/group`, `/api/balances`, `/api/settlements` returned HTTP 200.
- Browser visual inspection was unavailable because the earlier browser session was blocked by URL policy. Actual microphone hardware and real Claude calls were not tested in this phase.
- This checkout originally inherited an empty repository rooted at `E:/`. A separate repository was initialized inside the project on `codex/phase-1`, so its first commit records the existing application plus Phase 1. No published history was rewritten and nothing was pushed. Local env files, database and deployment output remain ignored.
