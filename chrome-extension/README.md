# Emergent Extractor — Chrome Extension

One-click capture of any browser tab → send to your Emergent Extractor backend → get AI-readable design DNA.

## What it does
- **Capture outerHTML** — grabs the fully-rendered DOM (post-JS) and POSTs to `/api/extract/html`
- **Capture screenshot** — either viewport-only (via Chrome `captureVisibleTab`) or full-page (via backend Playwright, server-side capture)
- **Capture both** — does both in one click
- Optional **project name**: auto-creates/attaches captures to a project so they show up together in the dashboard with DNA synthesis ready

## Install (unpacked, dev mode)

1. Open Chrome → `chrome://extensions/`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Pick the `/app/chrome-extension/` folder
5. Pin the icon to your toolbar

## Configure

On first click:

- **Backend URL**: paste your Emergent Extractor URL (e.g. `https://your-app.preview.emergentagent.com`) — no trailing slash
- **Project name**: optional, groups captures. Same name reuses the existing project.
- **Full-page screenshot**: ON = server-side Playwright (renders full scroll). OFF = visible viewport only (faster, no server spawn).

Settings persist via `chrome.storage.sync`.

## Permissions used
- `activeTab` + `scripting` — grab outerHTML from the current tab
- `storage` — remember backend URL / project name
- `<all_urls>` — so `fetch()` to your backend works regardless of the active tab origin

## Icons
Drop PNGs into `icons/` (16/48/128 px). They're referenced by `manifest.json` but not critical for local testing; Chrome will show a blank square if absent.
