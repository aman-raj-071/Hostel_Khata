# Accounts and private groups

## Phase 0 audit

Retired controls were implemented in the global controller/context, browser input hook, command parser, Add hero, shell, GroupTools narration, CSS and tests. Existing model: groups, members, expenses and expense_shares. Existing API: group, parse, expenses CRUD, balances, settlements, report, members CRUD, reminders, wrapped and health.

Plan: remove retired controls; add accounts and isolated demo sessions; enforce private membership/invites; add two-sided UPI confirmation; finish security, deployment and two-account verification.

Historic reports are retained as prior delivery evidence, not current usage instructions.

## Phase 1 result

Runtime source audit returned no matches (rg exit 1) for retired browser input/audio controls and command phrases. Legacy reports remain preserved as historical evidence after automatic approval rejected deleting/bulk-stripping them. Current README usage instructions were updated.

Large focused textarea, Brain-dump/Chat import and examples retained; Ctrl/Cmd+Enter parses, ordinary Enter/Fn stay normal; review/save remains explicit.

Checks: TypeScript, lint (0 errors), production frontend/API build and 61 backend tests passed. Frontend full run passed 28 tests but one worker timed out after host interruption; its two insight tests passed separately (30 unique frontend cases verified). Shortcut targeted run passed 5/5.

## Phase 2 result

Added email/password accounts, bcrypt 12-round hashes, opaque 256-bit sessions (only SHA-256 digests stored), httpOnly SameSite=Lax cookies (Secure/__Host- in production), signup/login/logout/me/profile, IP/email throttles and persistent ten-minute lockout after repeated failures. Profiles synchronize membership name/UPI. Tokens never enter browser storage.

Try demo creates a private five-person group with 25 expenses, isolated per session and expiring after 24 hours. Startup/hourly cleanup removes expired demo data; expiry rejects access immediately. Existing records remain preserved and are not assigned to new users. Group creation/join/admin controls follow in Phase 3.

Cookie-dependent requests include credentials; writes require an allowed Origin. All legacy app endpoints now resolve group scope from the authenticated active membership. Unknown/removed access is generic.

Verification: frontend 35/35; backend 61/61; real HTTP integration 10/10 (four account/session/demo tests plus six financial-flow cases). Final four auth cases also passed after atomic lockout/profile normalization. Frontend production build, root/server types and lint passed. Browser contexts A/B created different private demo group IDs, anonymous group access returned 401, session cookie was not JavaScript-readable and browser storage contained no login token.

## Phase 3 result

Private group onboarding, random expiring invites, pending approval, multi-group switching and complete admin/leave controls are implemented. Removed memberships retain history; all ledger endpoints enforce authenticated active membership. Legacy manual member creation now directs users to invitations. Existing database records are preserved.

Verification: 16/16 HTTP integration tests and 61/61 backend unit tests passed. Root/server TypeScript, lint (zero errors) and both production builds passed. Frontend test runner was invoked but its worker stalled on this host; targeted rerun is tracked for final verification. See PRIVATE_GROUPS.md for scope and manual checks.
