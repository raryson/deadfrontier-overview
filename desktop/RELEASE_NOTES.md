## Desktop 0.9.5 — distinguish outlined HUD digits 3 and 8

- Correct the digit-3 outline constraints so the closed left strokes of an 8 are not mistaken for a 3 in the lightweight HUD reader.
- Keep the native client-area geometry correction from 0.9.4 and the existing capture/OCR budgets.

Validation: the live window's exact XP readout was checked against a private local crop, including adjacent vertical crop offsets. Earlier raw-XP, bright-background and over-target Onslaught crops retained their expected readings. All 86 desktop tests passed on Windows with one Unix-native test skipped locally. No screenshots, session databases or credentials are included.
