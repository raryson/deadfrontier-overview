# Desktop platform support

## Current status

| Platform | Native Overview build | Game integration |
| --- | --- | --- |
| Windows x64 | Published | Automatic process/window detection, capture, overlay and session lifecycle |
| Linux x64 | Planned | Needs a native detector and capture/overlay validation |
| macOS Apple Silicon | Planned | Needs a native detector, permissions and capture/overlay validation |
| macOS Intel | Planned | Same integration work, with a separate architecture build |

The browser extension is a separate component. Its browser installation instructions remain applicable independently of the native desktop port.

## Game client and compatibility layers

The [official client download page](https://www.deadfrontier.com/ClientUpdate.php) currently lists a Windows installer. For the desktop port, the target environment needs to be confirmed: a native game client, or the Windows game running through Wine, Proton or CrossOver. Overview should run natively on the host operating system and identify the actual game window, rather than broadly capturing unrelated compatibility-layer windows.

## Work required before publishing native downloads

- Replace `desktop/native/WindowProbe.cs`, which calls Win32 APIs, with host-specific process/window discovery. Preserve process identity and session end detection.
- Validate that the selected game window maps to the Electron capture source. Window titles alone must not silently select another application.
- Validate overlay positioning and visibility, including multiple monitors and fullscreen mode.
- Preserve automatic loot detection without introducing continuous global keyboard logging. Windows-specific input hints and shortcuts need host-specific handling or clearly documented availability.
- Keep the reduced capture/OCR budgets introduced in Windows 0.8.3.
- Run packaging and tests on native CI runners, followed by real game-client testing on each supported environment.

## Capture requirements

**macOS:** screen capture requires the user's OS permission. A release must include instructions for granting that permission, and clearly state its signing/notarization status. Native packaging does not eliminate OS consent requirements.

**Linux:** X11 and Wayland/PipeWire must be treated separately. Electron documents that PipeWire capture exposes a single source selected through the portal; the Windows source-selection path cannot simply be reused. Automatic source selection and overlay behavior must be validated on the target desktop environment.

These constraints are documented in the [Electron desktop capture API](https://www.electronjs.org/docs/latest/api/desktop-capturer). Overview does not need audio capture.

## Intended artifacts

- Linux x64: portable `.tar.gz` bundle.
- macOS Apple Silicon: `.app` bundle in a ZIP.
- macOS Intel: separate `.app` bundle in a ZIP.

These are proposed package formats, not available downloads. The English installation guide will receive actual download links and platform-specific launch steps when the corresponding integrations and builds are ready for testers.
