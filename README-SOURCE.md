# Mozilla reviewer build instructions

This archive contains the readable, unminified first-party source of DeadFrontier Overview, its tests, exact dependency lockfile, packaging scripts and the unmodified third-party OCR distribution assets. It corresponds to extension version 0.8.0. No first-party bundler, transpiler, template engine or minifier is used.

## Environment and reproduction

The submitted package was built on Windows using Node.js 24.14.1, npm 11.11.0 and PowerShell 7. The packaging script requires PowerShell (not Windows PowerShell 5.1). The JavaScript tests and vendor-copy script also run on Linux; PowerShell 7 is required to run the ZIP packaging script there.

From the extracted archive's root, run:

```powershell
npm ci --ignore-scripts
npm run vendor:ocr
npm test
npm run check
./scripts/package.ps1
```

The resulting extension is `dist/deadfrontier-overview.zip`. Compare extracted entry contents with the submitted extension, rather than the ZIP's overall checksum: ZIP entry timestamps may differ. The package allowlist is in `scripts/package.ps1`. `scripts/vendor-ocr.mjs` copies the exact library files from npm without modification; it does not compile, minify or transform third-party code. npm downloads are needed only to reproduce the build, never during extension use.

For a Chrome-only package, run `./scripts/package-chrome.ps1`. It reuses the same file allowlist and changes only `manifest.json`, removing `browser_specific_settings` and `background.scripts` while preserving the module service worker. Its output is `dist/deadfrontier-overview-chrome.zip`; this is separate from the Firefox submission.

## Third-party packages

Exact package versions, registry locations and integrity hashes for all dependencies are in `package-lock.json`. All packages are public on npm. There are no private dependencies, credentials or environment variables needed to build.

- `tesseract.js` **7.0.0**: https://www.npmjs.com/package/tesseract.js/v/7.0.0 — readable JavaScript is in the package's `src/` directory; upstream source: https://github.com/naptha/tesseract.js . We copy `dist/tesseract.esm.min.js`, `dist/worker.min.js` and their license notices unchanged.
- `tesseract.js-core` **7.0.0** (locked transitive dependency): https://www.npmjs.com/package/tesseract.js-core/v/7.0.0 — upstream source: https://github.com/naptha/tesseract.js-core . We copy the six distributed `tesseract-core*.wasm.js` builds unchanged, including their embedded WebAssembly. This addon does not rebuild or alter the OCR engine.
- `@tesseract.js-data/eng` **1.0.0**: https://www.npmjs.com/package/@tesseract.js-data/eng/v/1.0.0 — upstream: https://github.com/naptha/tessdata . We copy only `4.0.0_best_int/eng.traineddata.gz`. This is recognition model data; no JavaScript from this package runs in the addon.

Original licenses and dependency notices are included in `vendor/ocr/`. See its README for details. The source of each public npm package and its release metadata can be retrieved using the pinned versions above and the lockfile.

## Review and testing notes

- The addon works with `https://fairview.deadfrontier.com/onlinezombiemmo/`. The user signs in through the game; no account credentials are provided with this submission.
- Bank actions are initiated by explicit user clicks. Authentication stays in the game's page context and is used only for the game's own endpoints. The addon does not store or forward authentication to its dashboard.
- Buff synchronization extracts a limited set of timer fields from the game page and its responses. XP capture is separate: a standalone extension tab uses `getDisplayMedia` after a user click and browser permission.
- The user selects the client window and verifies the crop around LV/XP. A session starts automatically on the first stable readout. Stop prevents automatic restarting; Reset saves the previous session and starts another on the next readout with active capture. The latest 100 sessions, including current progress, are saved locally. The worker, WASM and English OCR model are bundled locally. Frames stay in memory, with no audio, recording or upload. Stopping capture stops its media tracks.
- Session XP and XP/hour use visual readings. Base XP is explicitly an estimate based on a user-entered multiplier. HUD numbers abbreviated in K have approximately 1,000 XP precision.
- Tests use fictional inputs only. The source archive excludes Git history, local captures, browser profiles, diagnostics, secrets and game executables.

Mozilla guidance: https://extensionworkshop.com/documentation/publish/source-code-submission/ and https://extensionworkshop.com/documentation/publish/third-party-library-usage/ .

## Optional desktop price integration (0.9.0)

The extension optionally connects to the companion at 127.0.0.1:17373 after user-generated-code pairing. Optional host access is requested directly from the dashboard submit handler. The background module performs only public listing searches, with credentials omitted. catalog-observer.js reads public globalData definitions and calls the existing game scrapValue function for base equipment; only sanitized item/name/type/Yard fields are forwarded. No game authentication or seller identities are sent to the companion. Read docs/prices.md and the separate desktop sources in the repository for the full protocol. The extension source ZIP contains all extension modules and their tests; the Windows companion is a separate package.
