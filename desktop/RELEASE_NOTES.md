## Desktop 0.9.2 — adaptive crops and item-focused OCR

- Use actual captured-window dimensions with proportional/common HUD scales and bounded loot-panel geometry search; reset calibration after resize. Keep capture at 15 FPS.
- Focus loot OCR on the item text rather than artwork. Try line recognition, local contrast, sharpening and wrapped text crops, bounded to four passes per crop and eight per encounter; reduce work under backlog.
- Ignore known leading equipment colours when matching catalog entries. Exact catalog names can survive damaged choice text; ambiguous names and quantities remain reviewable.
- Remove the live loot list and add direct access to latest-session review. Preserve review of historical and unassigned captures.
- Keep the 0.9.1 fix for yellow/over-target XP and manual market sync limits.
- Allow a separate live profile through --data-dir ABSOLUTE_DIRECTORY for isolated testing.

Validation: 87 shared tests and 82 desktop tests passed on Windows, with one Unix-native test skipped locally. Four private game crops were recognized and journaled with the expected item names; images and databases are excluded from packages. Real-client resizing, DPI changes and additional loot types still need community testing. Linux/macOS remain experimental with the existing X11, Screen Recording and signing limitations.
