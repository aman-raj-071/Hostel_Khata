# Phase 2: reminder tones

- `POST /api/reminder` accepts `{ fromId, toId, amount, tone }` and returns `{ message }`. Shared Zod contracts validate positive rupee amounts with two-decimal precision and different group members. The endpoint is limited to 10 requests/minute/IP.
- Stub mode selects from two deterministic variants for polite, filmy, mummy and savage, without constructing Anthropic. Real generation uses the server key/model and `server/prompts/reminderPrompt.ts`; output is checked for names, exact amount, UPI mention, length and at most three lines.
- Each settlement row opens a bottom sheet with tone chips, skeleton, error/retry, editable text, Copy and an encoded WhatsApp draft. Empty text cannot be shared, clipboard errors preserve the message, and closed sheets ignore late responses.
- Missing UPI IDs are acknowledged. Reminders never send automatically, store contact details or record a payment.
- Test on `/settle`: Send reminder → choose tone → edit → Copy / Send on WhatsApp. Same stub input always generates the same variant. Existing API signatures, database schema and settlement confirmation are preserved.
