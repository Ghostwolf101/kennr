# Kennr — Edge Add-ons Store Listing

## Submission URL
https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview

---

## Extension package
File: `kennr-v0.1.0.zip`

## Store icon
File: `icons/icon300.png` (300×300 PNG)

## Screenshot
File: `screenshot-mockup.html` — open in browser at 1280×800, screenshot the full window.

---

## Listing fields

**Name**
Kennr

**Short description** (up to 132 chars)
Extract the design DNA from any webpage — colors, typography, and spacing — with one click. AI-powered analysis by Wyerd.

**Detailed description**
Kennr reads the design language of any webpage and extracts the underlying structure — color palettes, typography, spacing patterns — then runs it through an AI synthesis layer to give you a clear, usable output.

One click. Any page. No manual inspection.

Built for designers, developers, and anyone who needs to understand how a site is built at a glance. The AI layer is what makes it different — instead of raw CSS dumps, you get an interpreted design summary.

**Features:**
— One-click extraction from any active tab
— Captures outerHTML and full-page screenshot
— AI synthesis layer surfaces patterns, not just raw values
— Self-hostable backend — point it at your own Worker
— Apache 2.0 open source

Built by Wyerd · web.wyerd.org · Roaring Fork Valley, CO

**Category**
Developer Tools

**Privacy policy URL**
https://web.wyerd.org/kennr/privacy

**Website URL**
https://web.wyerd.org

**Support URL**
https://github.com/Ghostwolf101/kennr/issues

---

## Permissions justification (required by Edge)

- **activeTab** — reads the HTML and URL of the tab you explicitly click the button on. No background tab access.
- **scripting** — injects a script to capture outerHTML from the active tab only.
- **storage** — saves your backend URL and project name locally so you don't retype them.
- **host_permissions: <all_urls>** — required because users may run Kennr on any domain. No data is sent anywhere except the backend URL you configure.

---

## Notes
- Version: 0.1.0
- Manifest version: 3
- No remote code execution
- No tracking, no analytics, no data sold
