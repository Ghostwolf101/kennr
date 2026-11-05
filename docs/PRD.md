# Emergent Extractor — PRD

## Original Problem
Build an app that extracts relevant data from Emergent preview files (React source, rendered HTML, screenshots) for AI programs to consume and build unique visual aesthetics.

User: **Go wild, make it comprehensive.**

## Architecture
- **Backend**: FastAPI + Motor + Playwright (singleton browser pool) + emergentintegrations (Claude Sonnet 4.5)
- **Frontend**: React 19 + Tailwind + custom brutalist UI (Cabinet Grotesk + IBM Plex Mono)
- **DB**: MongoDB `extractions` + `projects` (indexed)
- **Chrome Extension**: MV3 (activeTab + scripting + storage) at `/app/chrome-extension/`

## Endpoints (all /api)
### Extraction
- POST /extract/react — parse .js/.jsx/.tsx multi-file
- POST /extract/html — parse outerHTML
- POST /extract/url — httpx fetch + parse (+ SSRF guard + rate limit)
- POST /extract/screenshot — upload → Claude vision (+ LLM rate limit)
- POST /screenshot/url — Playwright capture → Claude vision (+ SSRF + LLM rate limit)

### Synthesis
- POST /analyze/dna — combine extractions → DNA (+ LLM rate limit)
- POST /dna/diff — Claude diff of two DNAs (+ LLM rate limit)

### Projects
- POST / GET / GET {id} / PATCH {id} / DELETE {id} /projects
- POST /projects/{id}/analyze-dna (+ LLM rate limit)

### Token Export ✨ NEW
- GET /tokens/export/{ext_id} → {tokens, css, scss, tailwind_config_js, markdown_legend}

### CRUD
- GET /extractions, GET /extractions/{id}, DELETE /extractions/{id}

## Implemented

### Iteration 1 — MVP (2026-04-21)
- Full extractor pipeline for React/HTML/URL/Screenshot
- Brutalist dashboard UI with tabs
- DNA synthesis + bundle export
- Per-extraction Copy/Download JSON

### Iteration 2 — P1 features (2026-04-21)
- Playwright auto-screenshot of URLs (full-page)
- Projects system (CRUD + project-scoped DNA)
- DNA Diff with side-by-side comparison

### Iteration 3 — Hardening & Productization (2026-04-21) ✨
- **SSRF guard**: blocks localhost, 127.0.0.1, 169.254.*, RFC1918, IPv6 loopback/ULA/link-local, `.local`/`.internal` TLDs
- **Per-IP rate limits**: 40/hr for LLM endpoints, 300/hr for cheap endpoints (configurable via env)
- **Playwright browser pool**: singleton, recycled every 40 uses — cuts 5-10s cold-start per request
- **Token export**: CSS vars / SCSS / Tailwind config / Markdown brief from any extraction
- **Chrome extension** (Manifest V3): one-click capture outerHTML + screenshot from any tab, auto-attach to project
- Graceful shutdown closes Playwright browser

## Known Limitations / Deferred
- SSRF is vulnerable to DNS rebinding (P3) — resolve once, pin IP for actual fetch
- Rate limiter uses X-Forwarded-For[0] (spoofable) — OK as soft throttle, not security control (P3)
- _rate_buckets dict unbounded (P3) — add LRU cap for production
- Single-worker only (rate counter is in-process) — needs Redis for multi-replica
- No auth on endpoints (P2 — worth adding before public launch)
- Chrome extension accepts any backend URL (P3 — allowlist Emergent domains)

## Testing
- Iter 1: 12/15 (LLM flaky)
- Iter 2: 17/17 new + regression passing
- Iter 3: 26/26 new + 21/21 non-LLM regression passing (LLM regression skipped — upstream 502s)
