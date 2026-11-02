## Desktop 0.9.0 — experimental Linux and macOS ports

- Native Linux x64/X11 process and window detection; .deb installer and portable tar.gz.
- Native macOS Intel and Apple Silicon detectors; architecture-specific .app ZIPs, ad-hoc signed without Apple notarization.
- Matching native window IDs, process start identity, automatic session lifecycle and foreground overlay handling. Existing Windows integration retained.
- macOS Screen Recording consent is required. Input Monitoring is optional for Shift+F and E/F hints; automatic loot OCR remains available without it.
- Wayland is explicitly unsupported in this preview. Use an X11 session for automatic Linux tracking.
- Native build/helper self-tests, desktop regressions and archive checks run on matching Linux and Mac runners. Real-game capture, fullscreen and HUD scaling still require testing on each new platform.
- Reduced capture/OCR budgets and market caches from Windows 0.8.3 are preserved.

The English installation guide includes downloads, Linux installation, macOS architecture selection, permissions, local-data locations and current limitations. No user screenshots, sessions or game installers are included in these packages.
