# Emergent Extractor — PRD

## Original Problem Statement
Build an app that extracts relevant data from Emergent preview files:
- (A) React source files (.js/.jsx/.tsx) in /src
- (B) Rendered HTML (post-JS outerHTML)
- (C) Screenshots (PNG/JPG of sections / full page)
Output must be consumable by other AI programs to help with web development and unique visual aesthetics, stepping away from cookie-cutter designs.

User choice: **Go wild, make it comprehensive and AI-readable.**

## Architecture
- **Backend**: FastAPI + Motor (async Mongo), Playwright (headless Chromium) @ /pw-browsers
- **Frontend**: React 19 + React Router + Tailwind, custom Brutalist primitives
- **LLM**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations` + Emergent Universal LLM Key
- **Collections**: `extractions`, `projects` (both indexed on `id`)

## Endpoints (all /api)
### Extraction
- `POST /extract/react` — parse .js/.jsx/.tsx
- `POST /extract/html` — parse outerHTML
- `POST /extract/url` — httpx fetch + parse
- `POST /extract/screenshot` — upload image → Claude vision
- `POST /screenshot/url` ✨ **NEW** — Playwright capture URL → Claude vision
- `POST /analyze/dna` — combine extractions → DNA

### Projects ✨ **NEW**
- `POST /projects` — create
- `GET /projects` / `GET /projects/{id}` — list / populated get
- `PATCH /projects/{id}` — rename, add/remove extractions, set dna_id
- `DELETE /projects/{id}`
- `POST /projects/{id}/analyze-dna` — scoped DNA synthesis

### Diff ✨ **NEW**
- `POST /dna/diff` — Claude-powered structured diff between two DNA records

### CRUD
- `GET /extractions`, `GET /extractions/{id}`, `DELETE /extractions/{id}`

## Implemented (2026-04-21)
### Iteration 1
- Full extractor pipeline (React parser, HTML parser, URL fetch, vision, DNA synth)
- Brutalist dashboard UI (Cabinet Grotesk + IBM Plex Mono, signal red / yellow accents)
- Per-extraction cards with Copy/Download JSON + bundle export
- Error handling: HTTP 402 (LLM budget) / 502 (upstream) instead of raw 500
- MongoDB indexes on startup

### Iteration 2 ✨
- **Playwright auto-screenshot** of URLs (headless Chromium, full-page support, vision analysis)
- **Projects system** (create/rename/delete, auto-attach extractions when a project is active)
- **Project-scoped DNA synthesis** (dedicated endpoint stores dna_id on project)
- **DNA Diff** with side-by-side colors / typography / layout / motion / philosophy + merge recommendation
- UrlTab toggles between HTML-parse and auto-Screenshot modes
- ProjectsBar sidebar with inline rename & counters

## Known Limitations / Deferred
- No SSRF guard on /screenshot/url (P2 — block loopback/RFC1918)
- No browser pool — each screenshot spawns fresh Chromium (~5-10s cold start)
- No rate-limit / auth (P2 — public endpoints)
- DNA diff truncates JSON payload at 60000 chars raw (P3 — per-field truncate)
- DELETE /projects doesn't cascade to DNA extraction (P3)

## User Personas
- AI-assisted devs (Cursor/Claude/Copilot) recreating visual styles
- Designers auditing sites for design tokens
- Students studying what makes a design distinctive

## Backlog
- P2: SSRF allowlist + per-IP rate limit
- P2: Browser pool for screenshot endpoint
- P2: Figma-style token export (CSS vars / Tailwind config)
- P3: Chrome extension for one-click capture
- P3: Shareable public DNA links
