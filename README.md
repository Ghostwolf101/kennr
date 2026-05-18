# Kristh — Design DNA Extractor

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
| Backend | FastAPI + MongoDB (Motor) + Playwright |
| AI | Claude Sonnet via Anthropic API |
| Frontend | React 19 + Tailwind CSS |
| Chrome Extension | Manifest V3 — one-click capture from any tab |

---

## Quick start

### Backend

```bash
cd backend
cp .env.example .env        # fill in MONGO_URL, ANTHROPIC_API_KEY, DB_NAME
pip install -r requirements.txt
playwright install chromium
uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm start                   # runs on :3000, proxies API to :8001
```

### Chrome extension

1. Open `chrome://extensions` → Enable Developer Mode
2. Load unpacked → select `chrome-extension/`
3. Set the backend URL to `http://localhost:8001` in extension options

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

## Environment variables

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=kristh
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Cloudflare Worker variant

`kristh-worker` is a zero-dependency Cloudflare Worker port — same API surface, D1 instead of MongoDB, Workers AI instead of Anthropic API. Deploys globally with no infrastructure to manage.

See `../kristh-worker/` for source and `wrangler.toml` for bindings.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

Free to use, modify, and distribute. Patent grant included. Commercial use permitted.

---

## Built by

[Wyerd Web](https://web.wyerd.org) — Justin Hughes · Roaring Fork Valley, Colorado
