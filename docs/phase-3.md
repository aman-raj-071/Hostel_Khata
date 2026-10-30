# Phase 3: Hostel Wrapped

- `/api/wrapped?month=YYYY-MM` computes total, five awards and the biggest expense using integer paise. Repayments count toward net dues but not spend or generosity/tea awards. Ties resolve by member ID. Empty months and absent winners are explicit.
- Oldest unsettled debt means FIFO member net debt, measured at month-end or today, whichever is earlier. The schema does not track pair-specific repayment allocation; no exact late-payment history is claimed.
- One server-only Claude call writes all five captions, or stub mode returns deterministic factual Hinglish captions. A bounded process-local group/month cache coalesces concurrent opens and invalidates when facts/names/mode/model change. Cache is lost on restart; use shared persistence before horizontally scaling.
- `/wrapped` has month selection, vivid story cards, progress segments, swipe/arrows/keyboard navigation, empty/loading/error states and PNG export with html-to-image. Report and navigation link to it.
- Check: select a populated month, advance through total/awards/biggest/summary, export each PNG; reopen and verify the cached request. Actual browser export and real Claude require manual verification.
