# Private groups

Each signed-in account can create a group or request access with a random 10-character invite. Approval is on by default. Members can switch groups; switching reloads the app to discard the previous account/group cache. An unsaved review blocks switching until saved/discarded.

Admins approve/reject pending requests, remove members, rotate/revoke invites, configure expiry/usage caps and approval, transfer admin, or delete the group. Leaving requires a zero balance; the last admin must transfer ownership or delete. Removed memberships retain historical expenses but lose access immediately.

Every ledger request resolves the group through the database session and an active membership. Invite/group administration performs the same check on the requested group, with an admin check where needed. Caller-supplied member/expense identifiers cannot escape that scope. Parser names exclude pending and removed members. Profile updates never modify removed historical memberships.

Legacy unowned groups remain preserved but cannot be accessed by new accounts. Existing member IDs and expense foreign keys survive the members-to-group_members table rename. New memberships always link a real or isolated demo account. Manual member creation is replaced by invitations; the old API function returns a clear error.

Verification includes HTTP tests covering every protected ledger/group endpoint, pending and removed members, profile isolation, invitation expiry/revocation/exhaustion, per-user/IP join limits, persistent invalid-code lockout, leave/transfer/delete and group switching. Use two separate browser profiles to manually create, join, approve and test access removal.
