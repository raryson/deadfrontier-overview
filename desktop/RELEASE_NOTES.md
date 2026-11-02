## Desktop 0.9.1 — HUD reading, session review and manual prices

- Fix XP validation when the HUD stays at 100% while XP exceeds the level target, including the reported Onslaught case.
- Add a lightweight local stroke reader for the standard outlined HUD, including yellow text and exact XP without K. General OCR remains the fallback and is initialized only when needed. Capture FPS and recognition budgets are unchanged.
- Add sequential session OCR review: confirm an item, enter raw cash, skip a capture or ignore an image. Original locally stored images are preserved.
- Market searches run only on explicit clicks, scoped to the selected/latest session and loot from the last seven days. At most six queries per click and six per minute; cached quotes are reused. Remaining items do not trigger automatic continuation.
- Restore the dashboard when reopening a minimized window.

Verification: reported screenshot readouts checked locally; 87 extension tests and 78 desktop tests passed on Windows (one Unix-native test skipped). The user confirmed live XP counting after updating to 0.9.1. Linux and macOS packages retain experimental status: X11 is required on Linux; macOS needs Screen Recording permission and is ad-hoc signed, not notarized.

No player screenshots, session databases, credentials or game installers are included.
