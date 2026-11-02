# DeadFrontier Overview — Installation and Getting Started

DeadFrontier Overview has two separate components. You can use either one on its own.

| Component | What it does |
| --- | --- |
| Browser extension | Quick bank actions and buff timers on the Dead Frontier website. |
| Windows companion app | In-game overlay, XP/hour, session history, background loot OCR and estimated item values. |

The interface supports **English and Portuguese**. Select **English** from the language menu if needed.

## 1. Download

These are the published builds used in this guide:

| Download | Version | File |
| --- | --- | --- |
| [Chrome extension](https://github.com/raryson/deadfrontier-overview/releases/download/v0.9.6/deadfrontier-overview-chrome.zip) | 0.9.6 | `deadfrontier-overview-chrome.zip` |
| [Firefox extension](https://github.com/raryson/deadfrontier-overview/releases/download/v0.9.6/deadfrontier-overview.zip) | 0.9.6 | `deadfrontier-overview.zip` |
| [Windows app (x64)](https://github.com/raryson/deadfrontier-overview/releases/download/desktop-v0.8.1/deadfrontier-overview-windows-0.8.1.zip) | 0.8.1 | `deadfrontier-overview-windows-0.8.1.zip` |

Check the [Releases page](https://github.com/raryson/deadfrontier-overview/releases) for newer builds. Extension releases use tags such as `v0.9.6`; Windows releases use tags such as `desktop-v0.8.1`. Each component has its own version number.

You do not need Node.js, npm or developer tools to run the downloaded Windows app or install the packaged extension.

## 2. Install the browser extension

### Google Chrome

1. Download the **Chrome extension ZIP** above.
2. Extract it into a folder you intend to keep, for example `Documents\DeadFrontier Overview Extension`.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted **folder containing `manifest.json`**.
7. Open or reload [Dead Frontier](https://fairview.deadfrontier.com/onlinezombiemmo/index.php) and log in through the game website as usual.
8. Click the extension's toolbar icon or **DeadFrontier Overview** on the game page to open its panel.

Keep the extracted folder in place. Chrome loads the extension from that folder.

### Mozilla Firefox 140 or later

1. Download the **Firefox extension ZIP** above.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on…**.
4. Select `deadfrontier-overview.zip` directly. If you extracted it, select `manifest.json` inside its folder instead.
5. Open or reload [Dead Frontier](https://fairview.deadfrontier.com/onlinezombiemmo/index.php), log in normally and open the Overview panel.

**This ZIP installation is temporary:** Firefox removes it when the browser restarts. Repeat the loading steps after restarting Firefox. Permanent installation in regular Firefox requires a Mozilla-signed extension package; the ZIP linked above is the development installation described here.

### First use in the city

- **Quick bank:** check your balance, then use **Deposit all** or **Withdraw all** when you want that operation. You can use the panel from supported city pages without opening the bank page.
- **Buff timers:** the extension reads the active buff expiry times provided by the game. Open or reload a city page to synchronize them.
- The Windows app is independent of these city tools. You can keep using the extension while the Windows overlay tracks your run.

## 3. Install the Windows companion app

### Before you start

Have the official **Dead Frontier game client** installed. If you still need it, use the download and setup instructions supplied by the [official game website](https://fairview.deadfrontier.com/onlinezombiemmo/index.php), then launch the game normally.

### Install and launch Overview

1. Download the **Windows app ZIP** above.
2. Extract the **entire ZIP** into a folder you intend to keep.
3. Open the extracted `DeadFrontier Overview-win32-x64` folder.
4. Run **`DeadFrontier Overview.exe`**. Keep all the other extracted files beside it; run it from the extracted folder.
5. Leave **Track the game automatically** enabled.
6. Open the Dead Frontier client and enter the game.
7. The app detects the game window and starts a session after the first stable LV/XP readout. It does not require the browser's screen-sharing picker.
8. The overlay appears in the **bottom-right corner** while the game is in the foreground.

Closing the Overview dashboard leaves the app running in the system tray. Use **Quit app** to exit it completely.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| **Alt + Shift + D** | Show or hide the Overview dashboard. |
| **Alt + Shift + O** | Toggle the overlay. |
| **Shift + F** | Queue an extra manual loot snapshot while the game client is in the foreground. |

For manual loot capture, press **Shift + F once while the item-found dialog is visible**, then continue playing immediately. It uses recent dialog crops so OCR can finish after the dialog closes. The shortcut passes through to the game, so F may also perform its normal game action. Automatic capture remains enabled, and the two paths share the same dialog record to avoid duplicates.

## 4. Use the app

The sidebar opens one screen at a time:

- **Overview:** XP gained, XP/hour, duration, losses and shortcuts to your data.
- **Live loot:** identified items, quantities and potential values.
- **Session history:** previous runs, detailed XP and loot records, saved dialog images and CSV export.
- **Market prices:** manual price lookup and market-region selection.
- **Item mappings:** correct OCR names and review saved mappings.
- **Preferences:** XP multiplier, client-window selection, OCR calibration and optional extension integration.

### Sessions and XP

- Closing the **game client process** saves and ends its session. The history shows **Game client closed**.
- Reopening the client starts a new session at the first stable XP readout. Previous XP is used as the new reference, rather than counted as newly gained XP.
- Minimizing, loading a map or recreating the window within the same client execution keeps the session.
- Black loading screens wait for the HUD instead of reporting a readout error.
- **Stop session** freezes the results. **Save and reset session** preserves the previous session and starts another on the next stable readout.
- Estimated base XP requires your effective multiplier under **Preferences**. It is an estimate; the app does not infer all bonuses automatically.
- HUD values abbreviated with K have limited precision. Exact XP values without K are supported too.

### Loot and values

Loot OCR runs in the background on small dialog crops, sampled at up to 60 fps. Two OCR workers process frozen crops while you keep playing. You can accept items immediately or keep using F normally.

**The list records items seen in the dialog. It does not verify acceptance or entry into your backpack.** Its totals represent potential value, not confirmed sales or inventory. Loot OCR is still experimental.

- Ordinary weapons, armour and other equipment use the bundled **Yard/NPC base value**.
- Consumables and ammunition use public market listings. **Gasoline is valued per ml**.
- Custom/GC/NGC equipment requires an explicit manual query and exact variant selection.
- **Secronom Bunker / Outposts** is the default market region. Change it under **Market prices**.
- Public price lookup does **not** require a browser, login or pairing code. The extension connection under Preferences is optional and can update the public catalog.
- Ordinary items default to quantity 1. Ammunition and Gasoline require a validated quantity and remain excluded from totals until it is known. Prices are estimates and quotes expire after 15 minutes.

If a name is wrong or the app says **Waiting for game catalog**, open **Item mappings**, choose the OCR name and the matching original item, then click **Save mapping**. The mapping is stored on this computer and reused when OCR reads that same name again. Item names remain in their original language.

### Review a completed session

1. Open **Session history** and click **Session details** beside the run.
2. Review XP gained, XP/hour, losses, net XP, estimated base XP and duration.
3. Browse the loot table using **Previous/Next** (100 records per page). It includes all saved captures for that session, beyond the latest 200 shown in Live loot.
4. Click **Review** or a thumbnail to see the original OCR crop and recognized text. Select the correct catalog item and quantity, then save. Leave the mapping option enabled to reuse the corrected OCR name on future drops.
5. A capture that could not be read remains available for manual review. You can exclude a false detection from totals.

Small dialog images are saved locally by default. Disable **Save loot images** under **Preferences** to stop saving future crops. Existing records remain available. Images exist only for captures made with image saving enabled; older images cannot be recovered. OCR can still miss dialogs that are too brief or obscured; **Shift + F** provides an extra snapshot.

## 5. Troubleshooting

| Problem | What to check |
| --- | --- |
| Extension panel does not appear | Confirm the extension is enabled, reload the game page and open it from the browser toolbar. |
| Firefox extension disappeared | Temporary installations end when Firefox restarts; load the ZIP again. |
| Old extension version still appears | Replace all files, including `manifest.json`, reload the extension itself, then reload the game page and reopen the panel. |
| App cannot find the game | Open **Preferences**, select the client window, or set its process name without `.exe` if your client uses a different name. |
| Overlay is hidden | Enable the overlay, put the game in the foreground and try **Alt + Shift + O**. Minimizing the game hides the overlay. |
| XP stays unreadable with the HUD visible | Open **Preferences → Adjust XP region**, refresh the preview and drag a rectangle around the LV/XP line. |
| Loot name or quantity is wrong | Use **Item mappings** or edit the quantity in the loot row. Try **Shift + F** for an extra snapshot. |
| Price is missing | Check the item mapping, selected market region, quote age and quantity. An item absent from the bundled catalog may need a catalog update. |

## 6. Updates and local data

### Update the extension

- **Chrome:** replace the files in the same extracted extension folder, open `chrome://extensions` and click its **Reload** button.
- **Firefox:** for a ZIP installation, load the new ZIP through **Load Temporary Add-on…**. For an extracted-folder installation, replace all files and click **Reload** in `about:debugging`.
- In both browsers, close old Overview tabs, reload the game page and reopen the panel. Check the extension version in the browser's extension manager.

### Update the Windows app

1. Use **Quit app** to fully exit Overview.
2. Download and extract the entire new Windows ZIP.
3. Run the new `DeadFrontier Overview.exe` and update any shortcut you created.

The Windows history, settings and saved mappings live in `%APPDATA%\DeadFrontier Overview\`, separately from the portable app folder. Updates reuse those local data files. To make a backup, quit Overview first, then copy that user-data folder.

The browser extension stores its own data in that browser. Browser XP history is separate from the Windows app's history.

### Privacy

OCR runs locally. Small loot-dialog JPEG crops are saved locally in SQLite by default for later review; this can be disabled in Preferences. Full video frames and XP previews remain in memory. The app does not record audio or video and does not upload screenshots. Recognized text, session statistics and settings are stored locally. Clearing history also removes saved loot images. Market lookup makes requests for public item listings. The Windows app does not ask for your game password.

## 7. Feedback and contributions

This is an independent community project. Testing, bug reports, UI ideas and code contributions are welcome.

- [Open an issue](https://github.com/raryson/deadfrontier-overview/issues) with your app/extension version, browser, game resolution and steps to reproduce the problem.
- For OCR issues, include the expected item name or XP value. If you share a screenshot, crop it to the relevant HUD or item dialog and remove account details.
- [Open a pull request](https://github.com/raryson/deadfrontier-overview/pulls) for a contribution. Development setup is documented in the [Windows app README](desktop/README.md#desenvolvimento-e-reprodução) and [reviewer/source instructions](README-SOURCE.md).

[Repository](https://github.com/raryson/deadfrontier-overview) · [Releases](https://github.com/raryson/deadfrontier-overview/releases)
