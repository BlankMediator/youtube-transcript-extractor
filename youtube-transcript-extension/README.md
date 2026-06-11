# YouTube Transcript Extractor

Extract visible YouTube transcript rows from the current video page and show them in an on-page panel. The extension can copy the transcript or download it as TXT or JSON.

## Features

- Opens an on-page transcript tool from the extension toolbar.
- Extracts transcript rows that YouTube has rendered in the page.
- Shows the transcript in an editable on-screen text area.
- Toggles timestamps on or off for the displayed text, copied text, and TXT download.
- Downloads structured JSON with `{ "timestamp", "text" }` rows.
- Runs locally in the browser and does not send transcript text to any external server.

## Limitations

This extension reads transcript rows already rendered by YouTube. If YouTube does not provide a transcript for a video, or does not render the transcript panel for the current account/session/region, the extension cannot extract one.

## Install For Local Testing

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder.
5. Open a YouTube video page.
6. Click the extension icon.

## Chrome Web Store Package

Run `package-extension.ps1` from the repository root:

```powershell
.\package-extension.ps1
```

The uploadable zip will be created in `dist/`.

## Privacy

See `PRIVACY.md`.
