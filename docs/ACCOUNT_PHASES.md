# Accounts and private groups

## Phase 0 audit

Retired controls were implemented in the global controller/context, browser input hook, command parser, Add hero, shell, GroupTools narration, CSS and tests. Existing model: groups, members, expenses and expense_shares. Existing API: group, parse, expenses CRUD, balances, settlements, report, members CRUD, reminders, wrapped and health.

Plan: remove retired controls; add accounts and isolated demo sessions; enforce private membership/invites; add two-sided UPI confirmation; finish security, deployment and two-account verification.

Historic reports are retained as prior delivery evidence, not current usage instructions.

## Phase 1 result

Runtime source audit returned no matches (rg exit 1) for retired browser input/audio controls and command phrases. Legacy reports remain preserved as historical evidence after automatic approval rejected deleting/bulk-stripping them. Current README usage instructions were updated.

Large focused textarea, Brain-dump/Chat import and examples retained; Ctrl/Cmd+Enter parses, ordinary Enter/Fn stay normal; review/save remains explicit.

Checks: TypeScript, lint (0 errors), production frontend/API build and 61 backend tests passed. Frontend full run passed 28 tests but one worker timed out after host interruption; its two insight tests passed separately (30 unique frontend cases verified). Shortcut targeted run passed 5/5.
