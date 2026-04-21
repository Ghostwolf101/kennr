"""
Iteration-3 backend tests:
  * SSRF guard on /extract/url and /screenshot/url
  * Per-IP rate limiting (llm vs cheap buckets)
  * Browser pool reuse (singleton Playwright)
  * GET /tokens/export/{ext_id} for dna/html/url/react/screenshot kinds
  * Chrome extension manifest.json validity
"""
import os
import io
import json
import time
import base64
import subprocess
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

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


# ============ SSRF GUARD ============
BLOCKED = [
    "http://localhost",
    "http://localhost:8001",
    "http://127.0.0.1",
    "http://127.0.0.1:80",
    "http://169.254.169.254",  # AWS/GCP metadata
    "http://10.0.0.1",
    "http://192.168.1.1",
    "http://[::1]",
    "http://metadata.google.internal",
    "http://something.local",
    "http://something.internal",
]


@pytest.mark.parametrize("url", BLOCKED)
def test_ssrf_blocks_extract_url(client, url):
    r = client.post(f"{API}/extract/url", json={"url": url}, timeout=20)
    assert r.status_code == 400, f"{url} should be blocked, got {r.status_code}: {r.text[:200]}"
    assert "Blocked" in r.text or "not allowed" in r.text.lower() or "resolve" in r.text.lower(), r.text[:200]


@pytest.mark.parametrize("url", ["http://localhost", "http://127.0.0.1", "http://169.254.169.254"])
def test_ssrf_blocks_screenshot_url(client, url):
    r = client.post(f"{API}/screenshot/url", json={"url": url}, timeout=20)
    assert r.status_code == 400, f"{url} should be blocked, got {r.status_code}: {r.text[:200]}"
    assert "Blocked" in r.text or "resolve" in r.text.lower(), r.text[:200]


def test_extract_url_public_still_works(client):
    r = client.post(f"{API}/extract/url", json={"url": "https://example.com"}, timeout=45)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    CREATED_IDS.append(body["id"])
    assert body["kind"] == "url"
    assert body["data"]["source_url"].startswith("https://example.com")


# ============ TOKEN EXPORT ============
SAMPLE_HTML = """
<!doctype html><html><head><title>TokensPg</title>
<style>
  body { font-family: 'Inter', sans-serif; color: #111827; background: #fafafa; }
  .a { color: #ff0066; background: #3b82f6; border:1px solid #10b981; }
  .b { color: #ffffff; background: #000000; }
</style></head><body><h1>Tokens</h1><p class="a">x</p><p class="b">y</p></body></html>
"""


@pytest.fixture(scope="session")
def html_ext_id(client):
    r = client.post(f"{API}/extract/html", json={"html": SAMPLE_HTML, "source_url": "https://t.local"}, timeout=20)
    assert r.status_code == 200
    eid = r.json()["id"]
    CREATED_IDS.append(eid)
    return eid


@pytest.fixture(scope="session")
def react_ext_id(client):
    src = """
    import React from 'react';
    export default function X(){ return <div className="bg-indigo-500 text-white p-4" style={{color:'#ff00aa', background:'#222222'}}>hi</div>; }
    // #3b82f6 #10b981 #fafafa
    """
    r = client.post(f"{API}/extract/react", json={"files": [{"name": "X.jsx", "content": src}]}, timeout=30)
    assert r.status_code == 200
    eid = r.json()["id"]
    CREATED_IDS.append(eid)
    return eid


def test_tokens_export_404(client):
    r = client.get(f"{API}/tokens/export/does-not-exist-xyz", timeout=15)
    assert r.status_code == 404


def _assert_export_shape(body, expect_colors=True):
    assert "_id" not in body
    assert "tokens" in body and "css" in body and "scss" in body
    assert "tailwind_config_js" in body and "markdown_legend" in body
    t = body["tokens"]
    for k in ("primary", "neutral", "accent", "all_colors"):
        assert k in t and isinstance(t[k], list)
    assert t["fonts"] and isinstance(t["fonts"], dict)
    # tailwind js shape
    assert body["tailwind_config_js"].startswith("/** @type")
    assert "module.exports" in body["tailwind_config_js"]
    # markdown legend
    assert body["markdown_legend"].startswith("# Design Tokens")
    # css shape (only if colors or fonts present)
    assert body["css"].startswith(":root {")
    if expect_colors and (t["primary"] or t["neutral"] or t["accent"]):
        # at least one --color-* line present
        assert "--color-" in body["css"]
    # scss — will always have header comment
    assert body["scss"].startswith("// Source:")


def test_tokens_export_html(client, html_ext_id):
    r = client.get(f"{API}/tokens/export/{html_ext_id}", timeout=20)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    _assert_export_shape(body)
    t = body["tokens"]
    assert t["source_kind"] == "html"
    assert t["all_colors"], "html extraction should have colors"
    # luminance bucketing: #ffffff / #000000 go to neutral
    assert any(c in ("#ffffff", "#000000") for c in t["neutral"])
    # scss has $primary-style if colors were bucketed
    if t["primary"]:
        assert "$primary" in body["scss"]


def test_tokens_export_react(client, react_ext_id):
    r = client.get(f"{API}/tokens/export/{react_ext_id}", timeout=20)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    _assert_export_shape(body)
    assert body["tokens"]["source_kind"] == "react"


def test_tokens_export_url(client):
    # reuse an already-created url extraction (from ssrf-valid test)
    # find any url extraction id
    lst = client.get(f"{API}/extractions?limit=50", timeout=15).json()
    url_ids = [d["id"] for d in lst if d["kind"] == "url"]
    assert url_ids, "need a url extraction present"
    r = client.get(f"{API}/tokens/export/{url_ids[0]}", timeout=20)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    _assert_export_shape(body, expect_colors=False)
    assert body["tokens"]["source_kind"] == "url"


def test_tokens_export_dna_if_present(client):
    # best-effort: only run if a dna record exists already
    lst = client.get(f"{API}/extractions?limit=100", timeout=15).json()
    dna_ids = [d["id"] for d in lst if d["kind"] == "dna"]
    if not dna_ids:
        pytest.skip("No DNA record present to test dna kind export")
    r = client.get(f"{API}/tokens/export/{dna_ids[0]}", timeout=20)
    assert r.status_code == 200
    body = r.json()
    _assert_export_shape(body, expect_colors=False)
    assert body["tokens"]["source_kind"] == "dna"
    # CSS should reference --color-primary if any primary color exists
    t = body["tokens"]
    if t["primary"]:
        assert "--color-primary" in body["css"]
        assert "$primary" in body["scss"]


def test_tokens_export_screenshot_if_present(client):
    lst = client.get(f"{API}/extractions?limit=100", timeout=15).json()
    shot_ids = [d["id"] for d in lst if d["kind"] == "screenshot"]
    if not shot_ids:
        pytest.skip("No screenshot record to test screenshot kind export")
    r = client.get(f"{API}/tokens/export/{shot_ids[0]}", timeout=20)
    assert r.status_code == 200
    body = r.json()
    _assert_export_shape(body, expect_colors=False)
    assert body["tokens"]["source_kind"] == "screenshot"


# ============ BROWSER POOL TIMING ============
def test_screenshot_url_browser_pool_reuse(client):
    """Second /screenshot/url call should not re-launch chromium (singleton pool).
    We assert second call succeeds & is not dramatically slower than first-launch overhead.
    (Full timing assertions are flaky on shared envs; we mainly assert both succeed.)"""
    t0 = time.monotonic()
    r1 = client.post(
        f"{API}/screenshot/url",
        json={"url": "https://example.com", "full_page": False, "viewport_width": 800, "viewport_height": 600},
        timeout=180,
    )
    d1 = time.monotonic() - t0
    if r1.status_code == 402:
        pytest.skip("LLM budget exceeded — cannot validate browser pool timing")
    assert r1.status_code == 200, f"first: {r1.status_code} {r1.text[:300]}"
    b1 = r1.json()
    CREATED_IDS.append(b1["id"])
    assert "preview_base64" in b1 and b1["source_url"].startswith("https://example.com")

    t0 = time.monotonic()
    r2 = client.post(
        f"{API}/screenshot/url",
        json={"url": "https://example.org", "full_page": False, "viewport_width": 800, "viewport_height": 600},
        timeout=180,
    )
    d2 = time.monotonic() - t0
    if r2.status_code == 402:
        pytest.skip("LLM budget exceeded mid-test")
    assert r2.status_code == 200, f"second: {r2.status_code} {r2.text[:300]}"
    CREATED_IDS.append(r2.json()["id"])
    print(f"[browser_pool] first={d1:.2f}s second={d2:.2f}s")
    # second should not be more than ~1.8x the first (very loose — both include ~10-20s LLM)
    # If pool works, second excludes chromium launch (3-6s saved).
    assert d2 < d1 + 8, f"second call was not faster/similar: d1={d1:.1f} d2={d2:.1f}"


# ============ CHROME EXTENSION ============
def test_chrome_extension_manifest_valid():
    with open("/app/chrome-extension/manifest.json") as f:
        m = json.load(f)
    assert m["manifest_version"] == 3
    assert m["name"]
    assert "action" in m and "default_popup" in m["action"]
    assert "background" in m and "service_worker" in m["background"]


def test_chrome_extension_popup_uses_api_paths():
    with open("/app/chrome-extension/popup.js") as f:
        src = f.read()
    # references correct server endpoints
    for path in ("/extract/html", "/screenshot/url", "/projects"):
        assert path in src, f"popup.js missing reference to {path}"
    # uses /api prefix
    assert "/api" in src


# ============ RATE LIMIT ============
def _rewrite_env_with_llm_limit(limit_val):
    env_path = "/app/backend/.env"
    with open(env_path) as f:
        content = f.read()
    # strip any prior RATE_LIMIT_LLM line
    lines = [ln for ln in content.splitlines() if not ln.startswith("RATE_LIMIT_LLM")]
    lines.append(f"RATE_LIMIT_LLM={limit_val}")
    with open(env_path, "w") as f:
        f.write("\n".join(lines) + "\n")


def _remove_env_llm_limit():
    env_path = "/app/backend/.env"
    with open(env_path) as f:
        content = f.read()
    lines = [ln for ln in content.splitlines() if not ln.startswith("RATE_LIMIT_LLM")]
    with open(env_path, "w") as f:
        f.write("\n".join(lines) + "\n")


def test_rate_limit_llm_triggers_429(client):
    """Set RATE_LIMIT_LLM=2, restart backend, fire 4 /dna/diff calls.
    First 2 return 404 (fake ids), 3rd should be 429."""
    _rewrite_env_with_llm_limit(2)
    try:
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=False, timeout=30)
        # wait for backend to recover
        up = False
        for _ in range(30):
            time.sleep(1)
            try:
                h = client.get(f"{API}/", timeout=4)
                if h.status_code == 200:
                    up = True
                    break
            except Exception:
                continue
        assert up, "Backend did not recover after restart"

        statuses = []
        for i in range(4):
            r = client.post(
                f"{API}/dna/diff",
                json={"dna_a_id": f"fake-a-{i}", "dna_b_id": f"fake-b-{i}"},
                timeout=20,
            )
            statuses.append((r.status_code, r.text[:120]))
        print("rate_limit statuses:", statuses)

        # First 2 should NOT be 429 (they hit the handler and 404)
        assert statuses[0][0] != 429, statuses[0]
        assert statuses[1][0] != 429, statuses[1]
        # At least one of the subsequent calls should be 429
        later = [s for s, _ in statuses[2:]]
        assert 429 in later, f"Expected 429 after exceeding limit=2, got {statuses}"
        # confirm message contains Rate limit exceeded
        rl_msgs = [t for s, t in statuses[2:] if s == 429]
        assert any("Rate limit" in m for m in rl_msgs), rl_msgs
    finally:
        _remove_env_llm_limit()
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=False, timeout=30)
        # wait again
        for _ in range(30):
            time.sleep(1)
            try:
                if client.get(f"{API}/", timeout=4).status_code == 200:
                    break
            except Exception:
                continue


def test_rate_limit_cheap_separate_bucket(client):
    """After the LLM bucket was filled, /extract/url (cheap bucket) should still work."""
    r = client.post(f"{API}/extract/url", json={"url": "https://example.com"}, timeout=45)
    assert r.status_code == 200, f"cheap bucket should not be blocked by LLM exhaustion: {r.status_code} {r.text[:200]}"
    CREATED_IDS.append(r.json()["id"])
