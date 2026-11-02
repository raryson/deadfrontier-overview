# Desktop platform support

| Platform | Package | Validation |
| --- | --- | --- |
| Windows x64 | Portable ZIP | Existing real-client validation and automated regressions |
| Linux x64 / X11 | .deb and portable tar.gz | Experimental: native build, helper self-test, Node tests and packaging on Ubuntu 22.04 |
| macOS Apple Silicon | arm64 .app ZIP | Experimental: native build, helper self-test, Node tests and packaging on an ARM Mac runner |
| macOS Intel | x64 .app ZIP | Experimental: native build, helper self-test, Node tests and packaging on an Intel Mac runner |
| Linux Wayland | No automatic tracking | Portal-based capture and window/overlay integration remain future work |

See the [installation guide](../INSTALL-EN.md) for downloads and launch steps. The overview app runs natively on the host; a game client or compatibility layer is a separate installation.

## Detection and privacy

Windows retains its existing Win32 detector. Linux uses X11 window IDs and matching process identities from /proc; it does not read process command lines. macOS uses AppKit process identities and CoreGraphics window IDs. Only windows belonging to a recognized game process (or the explicitly configured process name) are emitted to the app. Another application's matching title alone does not select it.

The new helpers preserve session ownership by process ID and start time. They do not read game memory, traffic or credentials. Local capture/OCR budgets remain the same as the optimized Windows app.

E/F hold hints and Shift+F are observed only for the recognized foreground game. macOS additionally requires Input Monitoring for these optional key-state queries; denied permission leaves automatic loot OCR available. No typed-text log is stored.

## Permissions and limits

macOS requires the OS screen-capture permission. Bundles are ad-hoc signed, not Apple-notarized. The user must decide whether to authorize launching this community preview.

Linux support currently requires X11. Electron's PipeWire capture path exposes a portal-selected source, so a Wayland session is reported as unsupported rather than reusing Windows/X11 selection assumptions. See [Electron's desktop capture documentation](https://www.electronjs.org/docs/latest/api/desktop-capturer).

Builds and unit tests do not confirm real-game compatibility on Linux or macOS. Initial testers should verify client detection, XP calibration, loot images, fullscreen overlay behavior and session end/reopen behavior. Different client names can be configured in Preferences. The user-provided native client still needs validation on its target system.

## Reproduce builds

Use Node.js 24.14.1 and the pinned desktop lockfile. On Linux install g++ and libx11-dev; on macOS install Xcode Command Line Tools. Each build requires a matching host and architecture; cross-building a helper for another operating system is intentionally rejected.

From the desktop directory, install dependencies, install Electron's pinned runtime and run npm run package. Native helpers run their matching self-tests during the build. Run npm test afterwards. Use node scripts/package-unix.mjs from the repository root to create Unix archives (.deb is also produced on Linux).

The release workflow builds all four targets into a draft and publishes only after every job succeeds. It uploads only explicitly named app archives and checksums. Profiles, screenshots, game installers and user history are excluded.
