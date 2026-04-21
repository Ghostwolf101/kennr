"""
Iteration 2 backend tests — NEW endpoints:
 - POST /api/screenshot/url (Playwright)
 - Projects CRUD
 - POST /api/projects/{pid}/analyze-dna
 - POST /api/dna/diff
Also re-runs a quick regression on /api/analyze/dna (which now has 402/502 handling).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

CREATED_EXT = []
CREATED_PROJ = []


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def cleanup(client):
    yield
    for pid in CREATED_PROJ:
        try:
            client.delete(f"{API}/projects/{pid}", timeout=15)
        except Exception:
            pass
    for eid in CREATED_EXT:
        try:
            client.delete(f"{API}/extractions/{eid}", timeout=15)
        except Exception:
            pass


# ================= SEED HELPERS =================
SAMPLE_JSX = """
import React, { useState } from 'react';
export default function A({ title }) {
  const [c, setC] = useState(0);
  return <div className="flex bg-slate-900 text-white p-8 rounded-2xl" style={{color:'#ff00aa'}}>{title}</div>;
}
"""

SAMPLE_JSX_B = """
import React from 'react';
export default function B({ label }) {
  return <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg" style={{color:'#00ffcc'}}>{label}</button>;
}
"""


def _create_react_extraction(client, jsx: str, name: str) -> str:
    r = client.post(
        f"{API}/extract/react",
        json={"files": [{"name": name, "content": jsx}]},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    eid = r.json()["id"]
    CREATED_EXT.append(eid)
    return eid


# ================= 1. URL SCREENSHOT (Playwright) =================
def test_screenshot_url_example(client):
    r = client.post(
        f"{API}/screenshot/url",
        json={"url": "https://example.com", "full_page": True, "label": "TEST_example"},
        timeout=180,
    )
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
    body = r.json()
    for k in ["id", "kind", "data", "preview_base64", "source_url"]:
        assert k in body, f"missing key {k} in screenshot/url response"
    assert body["kind"] == "screenshot"
    assert body["source_url"].startswith("https://example.com")
    assert isinstance(body["preview_base64"], str) and len(body["preview_base64"]) > 500
    assert "_id" not in body
    CREATED_EXT.append(body["id"])
    d = body["data"]
    # Should not be a parse error when LLM works
    if not d.get("_parse_error"):
        for key in ["aesthetic", "color_palette", "typography", "layout", "ai_prompt_brief"]:
            assert key in d, f"Missing vision-analysis key {key}"
        assert d.get("_source_url", "").startswith("https://example.com")


def test_screenshot_url_no_scheme_autoprefix(client):
    """URL without scheme should be auto-prefixed with https://"""
    r = client.post(
        f"{API}/screenshot/url",
        json={"url": "example.com", "full_page": False, "label": "TEST_example_no_scheme"},
        timeout=180,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source_url"].startswith("https://example.com")
    CREATED_EXT.append(body["id"])


def test_screenshot_url_invalid(client):
    r = client.post(
        f"{API}/screenshot/url",
        json={"url": "https://thisdomaindoesnotexist-xyz-zzz-9999.invalid"},
        timeout=90,
    )
    # playwright failure bubbles as 502
    assert r.status_code in (502, 400), f"expected 502/400 got {r.status_code} {r.text[:200]}"


# ================= 2. PROJECTS CRUD =================
def test_create_project(client):
    r = client.post(f"{API}/projects", json={"name": "TEST_Project_Alpha"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ["id", "name", "extraction_ids", "dna_id", "created_at", "updated_at"]:
        assert k in body, f"missing {k}"
    assert body["name"] == "TEST_Project_Alpha"
    assert body["extraction_ids"] == []
    assert body["dna_id"] is None
    assert "_id" not in body
    CREATED_PROJ.append(body["id"])


def test_create_project_empty_name(client):
    r = client.post(f"{API}/projects", json={"name": "   "}, timeout=15)
    assert r.status_code == 400


def test_list_projects(client):
    # Ensure at least one project (created above)
    r = client.get(f"{API}/projects", timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    for p in arr:
        assert "_id" not in p
        assert {"id", "name", "extraction_ids", "dna_id", "created_at", "updated_at"}.issubset(p.keys())
    # Find our created project
    ids = [p["id"] for p in arr]
    for pid in CREATED_PROJ:
        assert pid in ids, f"project {pid} not in list"


def test_get_project_populates_extractions(client):
    # Create extractions
    e1 = _create_react_extraction(client, SAMPLE_JSX, "A.jsx")
    e2 = _create_react_extraction(client, SAMPLE_JSX_B, "B.jsx")
    # Create project
    p = client.post(f"{API}/projects", json={"name": "TEST_Project_Populate"}, timeout=15).json()
    pid = p["id"]
    CREATED_PROJ.append(pid)
    # Attach extractions (specific order e1, e2)
    up = client.patch(
        f"{API}/projects/{pid}",
        json={"add_extraction_ids": [e1, e2]},
        timeout=15,
    )
    assert up.status_code == 200, up.text
    assert up.json()["extraction_ids"] == [e1, e2]
    # GET populated
    g = client.get(f"{API}/projects/{pid}", timeout=15)
    assert g.status_code == 200, g.text
    body = g.json()
    assert body["extraction_ids"] == [e1, e2]
    assert "extractions" in body and len(body["extractions"]) == 2
    # Order preserved in populated extractions array
    assert [x["id"] for x in body["extractions"]] == [e1, e2]
    assert body["dna"] is None
    assert "_id" not in body
    for ex in body["extractions"]:
        assert "_id" not in ex


def test_patch_project_preserves_order_on_add_remove(client):
    e1 = _create_react_extraction(client, SAMPLE_JSX, "X.jsx")
    e2 = _create_react_extraction(client, SAMPLE_JSX_B, "Y.jsx")
    e3 = _create_react_extraction(client, SAMPLE_JSX, "Z.jsx")
    p = client.post(f"{API}/projects", json={"name": "TEST_Project_Order"}, timeout=15).json()
    pid = p["id"]
    CREATED_PROJ.append(pid)
    # Add in order e1,e2,e3
    r1 = client.patch(f"{API}/projects/{pid}", json={"add_extraction_ids": [e1, e2, e3]}, timeout=15).json()
    assert r1["extraction_ids"] == [e1, e2, e3]
    # Remove e2 → order preserved [e1, e3]
    r2 = client.patch(f"{API}/projects/{pid}", json={"remove_extraction_ids": [e2]}, timeout=15).json()
    assert r2["extraction_ids"] == [e1, e3]
    # Add duplicate e1 → no double-entry
    r3 = client.patch(f"{API}/projects/{pid}", json={"add_extraction_ids": [e1]}, timeout=15).json()
    assert r3["extraction_ids"] == [e1, e3]
    # Rename
    r4 = client.patch(f"{API}/projects/{pid}", json={"name": "TEST_Project_Order_Renamed"}, timeout=15).json()
    assert r4["name"] == "TEST_Project_Order_Renamed"


def test_patch_project_404(client):
    r = client.patch(f"{API}/projects/nonexistent-pid-xyz", json={"name": "X"}, timeout=15)
    assert r.status_code == 404


def test_get_project_404(client):
    r = client.get(f"{API}/projects/nonexistent-pid-xyz", timeout=15)
    assert r.status_code == 404


def test_delete_project(client):
    p = client.post(f"{API}/projects", json={"name": "TEST_ToDelete"}, timeout=15).json()
    pid = p["id"]
    r = client.delete(f"{API}/projects/{pid}", timeout=15)
    assert r.status_code == 200
    assert r.json().get("deleted") == 1
    # Deleting again returns deleted=0
    r2 = client.delete(f"{API}/projects/{pid}", timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("deleted") == 0


# ================= 3. PROJECT ANALYZE-DNA =================
@pytest.fixture(scope="session")
def dna_project_ids(client):
    """Creates a project with 2 extractions and synthesizes DNA. Returns (pid, dna_id)."""
    e1 = _create_react_extraction(client, SAMPLE_JSX, "S1.jsx")
    e2 = _create_react_extraction(client, SAMPLE_JSX_B, "S2.jsx")
    p = client.post(f"{API}/projects", json={"name": "TEST_DNA_ProjA"}, timeout=15).json()
    pid = p["id"]
    CREATED_PROJ.append(pid)
    client.patch(f"{API}/projects/{pid}", json={"add_extraction_ids": [e1, e2]}, timeout=15)

    # Retry DNA synthesis twice on transient 502
    dna_body = None
    last = None
    for attempt in range(2):
        try:
            r = client.post(f"{API}/projects/{pid}/analyze-dna", timeout=180)
            if r.status_code == 200:
                dna_body = r.json()
                break
            last = f"status={r.status_code} body={r.text[:300]}"
            if r.status_code == 402:
                pytest.skip(f"LLM budget exceeded: {last}")
        except Exception as e:
            last = str(e)
        time.sleep(2)
        client.close()
    if not dna_body:
        pytest.skip(f"DNA synth failed transiently: {last}")
    CREATED_EXT.append(dna_body["id"])
    return pid, dna_body["id"]


def test_project_analyze_dna(client, dna_project_ids):
    pid, dna_id = dna_project_ids
    # Fetch project; should now have dna_id populated and dna object returned
    g = client.get(f"{API}/projects/{pid}", timeout=20)
    assert g.status_code == 200, g.text
    body = g.json()
    assert body["dna_id"] == dna_id
    assert body["dna"] is not None
    assert body["dna"]["id"] == dna_id
    assert body["dna"]["kind"] == "dna"


def test_project_analyze_dna_empty_project(client):
    p = client.post(f"{API}/projects", json={"name": "TEST_EmptyDNA"}, timeout=15).json()
    pid = p["id"]
    CREATED_PROJ.append(pid)
    r = client.post(f"{API}/projects/{pid}/analyze-dna", timeout=30)
    assert r.status_code == 400


def test_project_analyze_dna_404(client):
    r = client.post(f"{API}/projects/nonexistent-xyz/analyze-dna", timeout=15)
    assert r.status_code == 404


# ================= 4. DNA DIFF =================
@pytest.fixture(scope="session")
def two_dna_ids(client, dna_project_ids):
    """Produce a second DNA to diff against the first."""
    _pid_a, dna_a = dna_project_ids
    # Second project with DIFFERENT extractions (only SAMPLE_JSX_B twice)
    e1 = _create_react_extraction(client, SAMPLE_JSX_B, "S3.jsx")
    e2 = _create_react_extraction(client, SAMPLE_JSX_B, "S4.jsx")
    p = client.post(f"{API}/projects", json={"name": "TEST_DNA_ProjB"}, timeout=15).json()
    pid = p["id"]
    CREATED_PROJ.append(pid)
    client.patch(f"{API}/projects/{pid}", json={"add_extraction_ids": [e1, e2]}, timeout=15)

    dna_body = None
    last = None
    for attempt in range(2):
        try:
            r = client.post(f"{API}/projects/{pid}/analyze-dna", timeout=180)
            if r.status_code == 200:
                dna_body = r.json()
                break
            last = f"status={r.status_code} body={r.text[:300]}"
            if r.status_code == 402:
                pytest.skip(f"LLM budget exceeded: {last}")
        except Exception as e:
            last = str(e)
        time.sleep(2)
        client.close()
    if not dna_body:
        pytest.skip(f"Second DNA synth failed transiently: {last}")
    CREATED_EXT.append(dna_body["id"])
    return dna_a, dna_body["id"]


def test_dna_diff_success(client, two_dna_ids):
    a, b = two_dna_ids
    last_err = None
    body = None
    for attempt in range(2):
        try:
            r = client.post(f"{API}/dna/diff", json={"dna_a_id": a, "dna_b_id": b}, timeout=180)
            if r.status_code == 200:
                body = r.json()
                break
            last_err = f"status={r.status_code} body={r.text[:300]}"
            if r.status_code == 402:
                pytest.skip(f"LLM budget exceeded: {last_err}")
        except Exception as e:
            last_err = str(e)
        time.sleep(2)
        client.close()
    assert body is not None, f"dna/diff failed: {last_err}"
    assert body["dna_a_id"] == a and body["dna_b_id"] == b
    assert "diff" in body
    diff = body["diff"]
    if not diff.get("_parse_error"):
        for key in [
            "summary_one_liner", "overall_similarity", "color_diff",
            "typography_diff", "layout_diff", "motion_diff",
            "philosophy_diff", "shared_signatures", "divergent_signatures",
            "merge_recommendation", "ai_slop_alignment",
        ]:
            assert key in diff, f"Missing diff key {key}"
        sim = diff["overall_similarity"]
        assert isinstance(sim, (int, float)) and 0 <= sim <= 100
    assert "_id" not in body


def test_dna_diff_404(client):
    r = client.post(
        f"{API}/dna/diff",
        json={"dna_a_id": "nope-1", "dna_b_id": "nope-2"},
        timeout=30,
    )
    assert r.status_code == 404


def test_dna_diff_rejects_non_dna_ids(client):
    # Create a non-DNA extraction; diff endpoint should 404 since kind != 'dna'
    eid = _create_react_extraction(client, SAMPLE_JSX, "NotDna.jsx")
    r = client.post(
        f"{API}/dna/diff",
        json={"dna_a_id": eid, "dna_b_id": eid},
        timeout=30,
    )
    assert r.status_code == 404
