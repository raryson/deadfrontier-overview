## Desktop 0.9.4 — native client-area geometry for windowed capture

- Use the detected client-area origin and size for HUD and loot crops. Windowed clients no longer depend only on fixed 0/32-pixel title-bar guesses.
- Support full-window, visible-border, client-only and downscaled capture candidates, while retaining legacy fallbacks when native geometry is unavailable.
- Refresh crop geometry when borders, DPI or client dimensions change, including when capture-frame dimensions stay the same. Moving a window without changing its client geometry does not reset calibration.
- Include capture-frame dimensions and native client geometry in explicitly enabled local diagnostics. No screenshot uploads or additional capture FPS.

Validation: 86 desktop tests passed on Windows with one Unix-native test skipped locally. The real client at 1600×1024 was captured at 1602×1050; the corrected reader accepted its HUD and automatically started a session. Live XP gain and additional window/DPI configurations remain to be checked. Linux/macOS retain experimental status.
