# Phase 4: hands-free flow

- Added “wrapped dikhao”, “reminder bhejo” and “haan theek hai”; existing “settle up kholo”, dictation, editing and numbered controls remain.
- Natural confirmation uses the visible confirmation/save action. Disabled or ambiguous controls cannot be bypassed. Multiple reminder rows require their button number; opening a reminder never sends WhatsApp automatically.
- Unsupported browsers hide the mic and explain the Wispr Flow/text fallback. The expense box remains available.
- Voice still uses one recognition session. Dictation stays bound to its field and treats command-like expense text as text until “likhna band”. Tab hiding, stop, navigation and unmount release/reset the appropriate state.
- Check: Add → dictate expense → “likhna band” → “parse karo” → review → “save karo” / “haan theek hai” → “settle up kholo” → numbered reminder → “wrapped dikhao”. Mic hardware accuracy remains a manual check.
