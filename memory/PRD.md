# Emergent Extractor — PRD

## Original Problem Statement
Build an app that extracts relevant data from Emergent preview files:
- (A) React source files (.js/.jsx/.tsx) in /src
- (B) Rendered HTML (post-JS outerHTML)
- (C) Screenshots (PNG/JPG of sections / full page)
Output must be consumable by other AI programs to help with web development and unique visual aesthetics, stepping away from cookie-cutter designs.

User choice: **Go wild, make it comprehensive and AI-readable.**

## Architecture
- **Backend**: FastAPI (Python) at `/api/*` on port 8001
- **Frontend**: React 19 + React Router + Tailwind + Shadcn-ish primitives, brutalist styling (Cabinet Grotesk + IBM Plex Mono)
- **DB**: MongoDB (motor async) — collection `extractions` with unique index on `id`
- **LLM**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations` (Emergent Universal LLM Key)
  - Vision: screenshot → JSON aesthetic report
  - Text: DNA synthesis combining all extractions → ready-to-paste AI prompt

## Core Endpoints (all /api)
- `POST /extract/react` — parse .js/.jsx/.tsx files
- `POST /extract/html` — parse pasted outerHTML
- `POST /extract/url` — fetch URL and parse (httpx, no JS execution)
- `POST /extract/screenshot` — Claude vision analysis of image (PNG/JPG/WEBP)
- `POST /analyze/dna` — combine saved extractions → rich design DNA
- `GET /extractions`, `GET /extractions/{id}`, `DELETE /extractions/{id}`

## Implemented (2026-04-21)
- Full extractor pipeline: React AST-lite + HTML BeautifulSoup + URL fetch + vision analysis + DNA synthesis
- Brutalist dashboard UI with tabs (React / HTML / Screenshot / URL)
- Per-extraction cards with Copy/Download JSON
- Bundle export (single JSON containing all extractions + DNA)
- Neo-brutalist styling (stark white/black, signal red, yellow accent, monospace)
- Error handling: 402 for LLM budget exceeded, 502 for upstream LLM unavailable
- MongoDB indexes on startup

## Known Limitations
- LLM-dependent endpoints (screenshot, DNA) require healthy Emergent LLM key with budget
- URL extraction does not execute JS (use HTML paste for JS-rendered sites)
- DNA synthesis may take 15–60s depending on upstream latency

## User Personas
- **AI-assisted developers** using Cursor/Claude/Copilot who want to recreate visual styles
- **Designers** auditing existing sites for design tokens
- **Students/Learners** studying what makes a design distinctive

## Backlog (P1/P2)
- P1: Playwright-based server-side screenshot of a URL (auto-capture)
- P1: Diff view between two DNA reports
- P1: Save projects (group extractions under a project)
- P2: Figma-style token export (CSS vars, Tailwind config)
- P2: Chrome extension to capture outerHTML + screenshot in one click
- P2: Share a public DNA link

## Next Action Items
- Top up Emergent LLM key when budget runs out (Profile → Universal Key → Add Balance)
- Consider adding API key input in the UI for users who want their own LLM key
