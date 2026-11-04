## Desktop 0.9.3 — white-text isolation on red loot dialogs

- Add a colour-aware OCR fallback that suppresses the red tint and saturated scenery behind the translucent loot panel, then expands contrast around the neutral white letters.
- Keep the original and contrast readings first, so an already agreed item name does not get replaced by a less accurate filtered reading with higher confidence.
- Keep text-only crops, quantity/conflict checks, the eight-attempt encounter cap and capture FPS unchanged.

Validation: targeted OCR/review tests passed and four private saved game crops retained the expected item names through OCR and journaling. One armour crop needed three passes instead of four in this small sample. This does not establish general OCR accuracy; other loot, lighting and UI scales still need testing. No private crops or session data are included.
