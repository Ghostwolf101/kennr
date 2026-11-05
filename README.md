# Kennr — Design DNA Extractor

Extract structured design data from any website, React codebase, or screenshot. Outputs AI-consumable JSON — color palettes, typography systems, spacing, component patterns, visual identity — ready to feed into any AI agent or design pipeline.

Built for Wyerd Web. Distributable as a standalone tool.

---

## What it does

1. **Extract** — point it at a URL, paste HTML, drop in React source files, or upload a screenshot
2. **Synthesize** — combine multiple extractions into a unified Design DNA profile
3. **Diff** — compare two DNA profiles to track design drift over time
4. **Export** — output CSS variables, SCSS tokens, Tailwind config, or Markdown brief

---

## Architecture

| Layer | Technology |
|-------|------------|
| Chrome Extension (this repo) | Manifest V3 — one-click capture from any tab |
| Backend | [`kennr-worker`](https://github.com/Ghostwolf101/kennr-worker) (private): a Cloudflare Worker with D1 storage and Workers AI |

---

## Quick start

1. Open `chrome://extensions` → Enable Developer Mode
2. Load unpacked → select `chrome-extension/`
3. Set the backend URL to your kennr-worker URL (e.g. `https://your-kennr-backend.workers.dev`) in the extension

---

## API endpoints

### Extraction

| Method | Path | Input |
|--------|------|-------|
| POST | `/api/extract/url` | `{ url, label? }` |
| POST | `/api/extract/html` | `{ html, source_url?, label? }` |
| POST | `/api/extract/react` | `{ files: [{name, content}], label? }` |
| POST | `/api/extract/screenshot` | `{ image_base64, label? }` |
| POST | `/api/screenshot/url` | `{ url, label? }` — Playwright capture |

### Synthesis

| Method | Path | Input |
|--------|------|-------|
| POST | `/api/analyze/dna` | `{ extraction_ids: [], project_name? }` |
| POST | `/api/dna/diff` | `{ dna_a_id, dna_b_id }` |

### Projects

| Method | Path | Notes |
|--------|------|-------|
| POST/GET | `/api/projects` | Create / list |
| GET/PATCH/DELETE | `/api/projects/{id}` | Single project |
| POST | `/api/projects/{id}/analyze-dna` | Synthesize DNA for project |

### Export

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/tokens/export/{extraction_id}` | CSS vars, SCSS, Tailwind config, Markdown brief |

---

## History

Kennr started as a FastAPI + MongoDB + React app built on Emergent (then named Kristh). That app and its Emergent deployment were retired on 2026-11-04 in favor of the Cloudflare Worker. The old code is kept, unchanged, at the git tag [`emergent-app-archive`](https://github.com/Ghostwolf101/kennr/tree/emergent-app-archive).

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

Free to use, modify, and distribute. Patent grant included. Commercial use permitted.

---

## Built by

[Wyerd Web](https://web.wyerd.org) — Justin Hughes · Roaring Fork Valley, Colorado
