"""
Backend API tests for Emergent Extractor.
Covers all endpoints prefixed with /api.
"""
import os
import io
import base64
import random
import pytest
import requests
from PIL import Image, ImageDraw, ImageFont

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fallback: read from frontend/.env
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

# Track created extraction ids for cleanup
CREATED_IDS = []


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def cleanup(client):
    yield
    for eid in CREATED_IDS:
        try:
            client.delete(f"{API}/extractions/{eid}", timeout=10)
        except Exception:
            pass


# ============ Health ============
def test_root_health(client):
    r = client.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert data.get("service") == "emergent-extractor"


# ============ React Extract ============
SAMPLE_JSX = """
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';

export default function HeroCard({ title, subtitle }) {
  const [count, setCount] = useState(0);
  useEffect(() => { document.title = title; }, [title]);
  return (
    <div className="flex flex-col items-center bg-slate-900 text-white p-8 rounded-2xl shadow-xl">
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="text-slate-300 mt-2" style={{color: '#f0abfc'}}>{subtitle}</p>
      <Button onClick={() => setCount(count+1)} className="mt-4 bg-indigo-500 hover:bg-indigo-600">Clicks: {count}</Button>
    </div>
  );
}
"""


def test_extract_react_success(client):
    payload = {"files": [{"name": "HeroCard.jsx", "content": SAMPLE_JSX}]}
    r = client.post(f"{API}/extract/react", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "id" in body and body["kind"] == "react"
    CREATED_IDS.append(body["id"])
    data = body["data"]
    assert data["file_count"] == 1
    assert "HeroCard" in data["components"]
    assert any("useState" in h for h in data["top_hooks"].keys())
    assert any("useEffect" in h for h in data["top_hooks"].keys())
    # tailwind classes captured
    assert data["top_tailwind_classes"], "No tailwind classes aggregated"
    assert "flex" in data["top_tailwind_classes"] or "bg-slate-900" in data["top_tailwind_classes"]
    # color tokens
    assert any("#f0abfc" in c for c in data["color_tokens"].keys())
    # imports
    assert "react" in [i.lower() for i in data["top_imports"].keys()]
    # no mongo _id leak
    assert "_id" not in body
    assert "_id" not in data


def test_extract_react_empty_files(client):
    r = client.post(f"{API}/extract/react", json={"files": []}, timeout=15)
    assert r.status_code == 400


# ============ HTML Extract ============
SAMPLE_HTML = """
<!doctype html>
<html>
<head>
  <title>Test Page</title>
  <meta name="description" content="Demo page for extractor">
  <link rel="stylesheet" href="/static/main.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; color: #111827; background: #fafafa; }
    .cta { background: rgb(59, 130, 246); }
  </style>
</head>
<body>
  <header class="site-header"><nav aria-label="main"><a href="/">Home</a></nav></header>
  <main>
    <section class="hero">
      <h1>Welcome</h1>
      <p style="color:#ff0066">Subtitle</p>
      <button class="cta btn btn-primary" aria-label="Try">Try it</button>
    </section>
    <article><h2>Post</h2><img src="/a.png" alt="a"/></article>
  </main>
  <footer role="contentinfo">© 2026</footer>
</body>
</html>
"""


def test_extract_html_success(client):
    r = client.post(f"{API}/extract/html", json={"html": SAMPLE_HTML, "source_url": "https://test.local"}, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["kind"] == "html"
    CREATED_IDS.append(body["id"])
    d = body["data"]
    assert d["title"] == "Test Page"
    assert d["meta_description"] == "Demo page for extractor"
    assert d["semantic_tag_counts"].get("header", 0) >= 1
    assert d["semantic_tag_counts"].get("main", 0) >= 1
    assert d["semantic_tag_counts"].get("footer", 0) >= 1
    assert d["buttons_count"] == 1
    assert "cta" in d["top_classes"]
    # colors detected from style tag
    assert any("#111827" in c or "#fafafa" in c or "#ff0066" in c for c in d["color_tokens"].keys())
    # aria
    assert "aria-label" in d["aria_usage"]
    assert "role" in d["aria_usage"]
    assert d["google_fonts_links"], "google fonts link not detected"
    assert "_id" not in body and "_id" not in d


# ============ URL Extract ============
def test_extract_url_success(client):
    r = client.post(f"{API}/extract/url", json={"url": "https://example.com"}, timeout=45)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["kind"] == "url"
    CREATED_IDS.append(body["id"])
    assert body["html_length"] > 0
    d = body["data"]
    assert d["source_url"] == "https://example.com"
    assert d["title"] and "Example" in d["title"]
    assert d["total_elements"] > 0
    assert "_id" not in body


def test_extract_url_invalid(client):
    r = client.post(f"{API}/extract/url", json={"url": "https://thisdomaindoesnotexist-xyz-abc-1234567.invalid"}, timeout=30)
    assert r.status_code == 400


# ============ Screenshot Extract ============
def _make_real_image_b64() -> str:
    """Create a realistic small UI mock (not blank/solid) as JPEG b64."""
    random.seed(7)
    img = Image.new("RGB", (640, 400), (22, 28, 40))
    d = ImageDraw.Draw(img)
    # top bar
    d.rectangle([0, 0, 640, 56], fill=(14, 18, 28))
    d.rectangle([20, 18, 120, 40], fill=(99, 102, 241))  # logo block
    # hero heading
    d.rectangle([40, 110, 420, 150], fill=(248, 250, 252))
    d.rectangle([40, 170, 360, 200], fill=(148, 163, 184))
    d.rectangle([40, 210, 300, 230], fill=(148, 163, 184))
    # CTA buttons
    d.rectangle([40, 260, 170, 300], fill=(236, 72, 153))
    d.rectangle([190, 260, 320, 300], outline=(236, 72, 153), width=2)
    # card grid
    for i in range(3):
        x = 40 + i * 180
        d.rectangle([x, 330, x + 150, 380], fill=(30, 41, 59), outline=(71, 85, 105), width=1)
    # some texture: scattered small dots
    for _ in range(400):
        x = random.randint(0, 639)
        y = random.randint(0, 399)
        d.point((x, y), fill=(random.randint(40, 200),) * 3)
    try:
        d.text((44, 120), "EMERGENT", fill=(248, 250, 252))
    except Exception:
        pass
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="session")
def screenshot_b64():
    return _make_real_image_b64()


def test_extract_screenshot_success(client, screenshot_b64):
    payload = {"image_base64": screenshot_b64, "mime_type": "image/jpeg", "label": "hero-mock"}
    r = client.post(f"{API}/extract/screenshot", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["kind"] == "screenshot"
    CREATED_IDS.append(body["id"])
    d = body["data"]
    # should not be a parse error
    assert not d.get("_parse_error"), f"Vision returned parse error: {d.get('raw', '')[:500]}"
    # schema keys
    for key in ["aesthetic", "color_palette", "typography", "layout", "ai_prompt_brief"]:
        assert key in d, f"Missing key {key} in screenshot analysis"
    assert isinstance(d["color_palette"], list) and len(d["color_palette"]) > 0
    assert "_id" not in body


def test_extract_screenshot_invalid(client):
    r = client.post(
        f"{API}/extract/screenshot",
        json={"image_base64": "not-base64!!!", "mime_type": "image/png"},
        timeout=30,
    )
    assert r.status_code == 400


# ============ Listing / Retrieval / Delete ============
def test_list_extractions(client):
    r = client.get(f"{API}/extractions?limit=50", timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    # ensure no data field leaked into list view
    for item in arr:
        assert "data" not in item
        assert "_id" not in item
        assert set(["id", "kind", "label", "created_at"]).issuperset(item.keys())


def test_get_extraction_by_id(client):
    assert CREATED_IDS, "No extractions created to fetch"
    eid = CREATED_IDS[0]
    r = client.get(f"{API}/extractions/{eid}", timeout=15)
    assert r.status_code == 200
    doc = r.json()
    assert doc["id"] == eid
    assert "_id" not in doc
    assert "data" in doc


def test_get_extraction_404(client):
    r = client.get(f"{API}/extractions/nonexistent-id-xyz", timeout=15)
    assert r.status_code == 404


# ============ DNA Synthesis ============
def test_analyze_dna(client):
    # require at least 2 different kinds
    assert len(CREATED_IDS) >= 2, "Need multiple extractions for DNA test"
    # use the first 3 ids (react, html, url or screenshot depending on order)
    ids = CREATED_IDS[:3]
    last_err = None
    body = None
    # Retry up to 2 times to absorb transient upstream LLM 502s
    for attempt in range(2):
        try:
            r = client.post(
                f"{API}/analyze/dna",
                json={"extraction_ids": ids, "project_name": "TEST_DNA_Project"},
                timeout=180,
            )
            if r.status_code == 200:
                body = r.json()
                break
            last_err = f"status={r.status_code} body={r.text[:300]}"
        except Exception as e:
            last_err = str(e)
        # drop pooled connections before retry
        client.close()
    # Force drop connection pool after DNA call (prevents stale keep-alive issues)
    client.close()
    assert body is not None, f"DNA call failed after retries: {last_err}"
    assert body["kind"] == "dna"
    CREATED_IDS.append(body["id"])
    assert body["source_count"] >= 2
    d = body["data"]
    assert not d.get("_parse_error"), f"DNA parse error: {str(d.get('raw',''))[:400]}"
    for key in ["project_fingerprint", "design_tokens", "component_patterns",
                "ai_slop_avoidance", "ready_to_use_ai_prompt", "ready_to_use_markdown_brief"]:
        assert key in d, f"Missing DNA key {key}"
    assert "_id" not in body


def test_analyze_dna_empty_ids(client):
    r = client.post(f"{API}/analyze/dna", json={"extraction_ids": []}, timeout=60)
    assert r.status_code == 400


def test_analyze_dna_unknown_ids(client):
    r = client.post(f"{API}/analyze/dna",
                    json={"extraction_ids": ["nope-1", "nope-2"], "project_name": "TEST_x"},
                    timeout=60)
    assert r.status_code == 404


# ============ Delete ============
def test_delete_extraction(client):
    # create a quick extraction then delete and verify
    payload = {"files": [{"name": "T.jsx", "content": "export const T = () => <div className='p-2'/>;"}]}
    r = client.post(f"{API}/extract/react", json=payload, timeout=60)
    assert r.status_code == 200
    eid = r.json()["id"]
    dr = client.delete(f"{API}/extractions/{eid}", timeout=30)
    assert dr.status_code == 200
    assert dr.json().get("deleted") == 1
    gr = client.get(f"{API}/extractions/{eid}", timeout=30)
    assert gr.status_code == 404
