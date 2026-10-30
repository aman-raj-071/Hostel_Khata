# UPI and receipt confirmation

The app does not move money, charge a fee or verify bank transfers automatically. Payers open their UPI app or scan the receiver QR; desktop puts QR first. A missing UPI ID shows a copyable request. Demo UPI addresses are fictitious and payment links are suppressed in the demo sandbox.

Only the signed-in payer may submit an I've paid claim, with a partial amount and optional UTR/note. The claim is pending; balances stay unchanged. Only the receiver can Confirm received or Dispute. The payer can cancel a pending claim. A receiver can independently record Received in cash. UPI references are notes, not bank verification.

Confirmation runs in a serializable transaction, rechecks both active memberships and current net debt/credit, changes pending status conditionally and creates exactly one linked Settlement expense. A unique payment-to-expense reference and idempotent repeat confirmation prevent double counting. Pending claims reserve the sender's debt and receiver's credit, preventing duplicate/overlapping claims. Stale claims fail clearly and can be cancelled. Dispute/cancellation does not add ledger entries. Resolved states cannot transition again. Membership removal cancels affected pending claims.

Confirmed payment expenses cannot be edited/deleted through expense CRUD. Direct Settlement imports/saves are rejected and users are directed to Settle. Group deletion explicitly deletes payment records before ledger records. Money stays integer paise throughout database and balance logic.

The bell counts incoming pending receipts plus disputes involving the payer/admin. The group inbox shows all scoped payment records. Payment, settlement and balance screens refresh every 15 seconds; normal query refresh also runs after local actions. No email/SMS is sent. Reminder text appends the receiver's correctly encoded UPI link when available.

HTTP integration tests cover permissions, outsider/anonymous access, invalid amounts, pending balance invariance, duplicate reservations, cancel/dispute terminal states, stale claims, concurrent and repeated confirmation, ledger protection, zero balances and receiver-only cash. Frontend tests cover explicit receipt confirmation, payer-only cancellation controls and UPI encoding. Existing settled-state mascot/confetti is reused. No gateway or Razorpay stretch is included.

For a live check: two real accounts in separate browser contexts, join/approve one private group, save a shared expense, set receiver UPI in Profile, open QR, submit a claim as payer, check unchanged balances, then verify receipt and confirm as receiver. Verify the second confirm adds no new settlement. Do not send real money during automated tests.
