"""
EMERGENT EXTRACTOR — Backend
Extracts structured design + code data from React source, HTML, URLs and screenshots.
Output is AI-consumable JSON/Markdown for use by other AI agents.
"""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bs4 import BeautifulSoup
import httpx
import os
import re
import uuid
import json
import base64
import io
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from collections import Counter
from PIL import Image

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI(title="Emergent Extractor")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("extractor")


# ============ MODELS ============
class ReactExtractInput(BaseModel):
    files: List[Dict[str, str]]  # [{name, content}]


class HtmlExtractInput(BaseModel):
    html: str
    source_url: Optional[str] = None


class UrlExtractInput(BaseModel):
    url: str


class ScreenshotExtractInput(BaseModel):
    image_base64: str
    mime_type: str = "image/png"
    label: Optional[str] = None


class CombinedAnalyzeInput(BaseModel):
    extraction_ids: List[str]
    project_name: Optional[str] = "Untitled Project"


class ExtractionRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str  # react | html | url | screenshot | dna
    label: Optional[str] = None
    data: Dict[str, Any]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class UrlScreenshotInput(BaseModel):
    url: str
    full_page: bool = True
    viewport_width: int = 1440
    viewport_height: int = 900
    label: Optional[str] = None


class ProjectCreateInput(BaseModel):
    name: str


class ProjectUpdateInput(BaseModel):
    name: Optional[str] = None
    add_extraction_ids: Optional[List[str]] = None
    remove_extraction_ids: Optional[List[str]] = None
    dna_id: Optional[str] = None


class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    extraction_ids: List[str] = Field(default_factory=list)
    dna_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class DnaDiffInput(BaseModel):
    dna_a_id: str
    dna_b_id: str



# ============ REACT SOURCE PARSING ============
HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}){1,2}\b")
RGB_RE = re.compile(r"rgba?\([^)]+\)")
HSL_RE = re.compile(r"hsla?\([^)]+\)")
IMPORT_RE = re.compile(r'^\s*import\s+(?:(?:[\w*{},\s]+)\s+from\s+)?["\']([^"\']+)["\']', re.MULTILINE)
COMPONENT_RE = re.compile(r"(?:export\s+(?:default\s+)?(?:function|const)|function|const)\s+([A-Z][A-Za-z0-9_]+)")
HOOK_RE = re.compile(r"\buse([A-Z][A-Za-z0-9_]*)\s*\(")
PROP_DESTRUCTURE_RE = re.compile(r"function\s+[A-Z][A-Za-z0-9_]*\s*\(\s*\{\s*([^}]+)\s*\}")
CLASSNAME_RE = re.compile(r'className\s*=\s*(?:"([^"]+)"|\'([^\']+)\'|\{`([^`]+)`\}|\{"([^"]+)"\})')
STYLE_RE = re.compile(r"style\s*=\s*\{\{([^}]+)\}\}")
JSX_TAG_RE = re.compile(r"<([A-Z][A-Za-z0-9]+|[a-z]+)\b")

TAILWIND_BUCKETS = {
    "color": re.compile(r"^(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|outline|divide|placeholder|decoration|caret|accent)-"),
    "spacing": re.compile(r"^(?:p|m|px|py|pt|pr|pb|pl|mx|my|mt|mr|mb|ml|space|gap)(?:-[a-z0-9]+)?-"),
    "sizing": re.compile(r"^(?:w|h|min-w|min-h|max-w|max-h|size)-"),
    "typography": re.compile(r"^(?:text|font|leading|tracking|align|uppercase|lowercase|capitalize|italic|underline|no-underline)"),
    "layout": re.compile(r"^(?:flex|grid|block|inline|hidden|container|absolute|relative|fixed|sticky|inset|top|right|bottom|left|z|col|row|order|justify|items|content|self|place)"),
    "border": re.compile(r"^(?:border|rounded|divide-x|divide-y)"),
    "effects": re.compile(r"^(?:shadow|opacity|blur|brightness|contrast|grayscale|saturate|sepia|invert|hue-rotate|backdrop|mix-blend|filter)"),
    "transitions": re.compile(r"^(?:transition|duration|ease|delay|animate)"),
    "interactive": re.compile(r"^(?:hover|focus|active|disabled|group|peer|dark|sm|md|lg|xl|2xl):"),
}


def bucket_tailwind(cls: str) -> str:
    for name, pat in TAILWIND_BUCKETS.items():
        if pat.match(cls):
            return name
    return "other"


def extract_react_file(name: str, content: str) -> Dict[str, Any]:
    imports = IMPORT_RE.findall(content)
    components = list(dict.fromkeys(COMPONENT_RE.findall(content)))
    hooks = list(dict.fromkeys(["use" + h for h in HOOK_RE.findall(content)]))
    props_match = PROP_DESTRUCTURE_RE.search(content)
    props = []
    if props_match:
        props = [p.strip().split("=")[0].split(":")[0].strip() for p in props_match.group(1).split(",") if p.strip()]

    classes: List[str] = []
    for m in CLASSNAME_RE.finditer(content):
        group = next((g for g in m.groups() if g), "")
        for c in group.split():
            classes.append(c)

    inline_styles = [s.strip() for s in STYLE_RE.findall(content)]
    jsx_tags = JSX_TAG_RE.findall(content)
    colors = list(set(HEX_RE.findall(content) + RGB_RE.findall(content) + HSL_RE.findall(content)))

    buckets: Dict[str, List[str]] = {}
    for c in classes:
        key = bucket_tailwind(c)
        buckets.setdefault(key, []).append(c)

    return {
        "file": name,
        "line_count": content.count("\n") + 1,
        "imports": imports,
        "component_names": components,
        "hooks_used": hooks,
        "props": props,
        "jsx_tags": dict(Counter(jsx_tags).most_common(30)),
        "tailwind_classes": {k: dict(Counter(v).most_common(20)) for k, v in buckets.items()},
        "tailwind_class_total": len(classes),
        "tailwind_class_unique": len(set(classes)),
        "inline_styles": inline_styles[:20],
        "colors": colors,
    }


def aggregate_react(files_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    all_tags: Counter = Counter()
    all_classes: Counter = Counter()
    all_hooks: Counter = Counter()
    all_imports: Counter = Counter()
    all_colors: Counter = Counter()
    all_components: List[str] = []
    buckets_merged: Dict[str, Counter] = {}

    for f in files_data:
        all_tags.update(f["jsx_tags"])
        for bucket, classes in f["tailwind_classes"].items():
            buckets_merged.setdefault(bucket, Counter()).update(classes)
            all_classes.update(classes)
        all_hooks.update(f["hooks_used"])
        all_imports.update(f["imports"])
        all_colors.update(f["colors"])
        all_components.extend(f["component_names"])

    return {
        "file_count": len(files_data),
        "total_lines": sum(f["line_count"] for f in files_data),
        "components": list(dict.fromkeys(all_components)),
        "top_jsx_tags": dict(all_tags.most_common(25)),
        "top_tailwind_classes": dict(all_classes.most_common(50)),
        "tailwind_buckets": {k: dict(v.most_common(30)) for k, v in buckets_merged.items()},
        "top_hooks": dict(all_hooks.most_common(20)),
        "top_imports": dict(all_imports.most_common(25)),
        "color_tokens": dict(all_colors.most_common(40)),
        "per_file": files_data,
    }


# ============ HTML PARSING ============
def extract_html_data(html: str, source_url: Optional[str] = None) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")

    tag_counter: Counter = Counter()
    class_counter: Counter = Counter()
    id_list: List[str] = []
    inline_styles: List[str] = []
    aria_attrs: Counter = Counter()
    semantic_tags = {"header", "nav", "main", "section", "article", "aside", "footer", "figure", "figcaption", "details", "summary"}
    semantic_count: Counter = Counter()

    for el in soup.find_all(True):
        tag_counter[el.name] += 1
        if el.name in semantic_tags:
            semantic_count[el.name] += 1
        cls = el.get("class") or []
        for c in cls:
            class_counter[c] += 1
        if el.get("id"):
            id_list.append(el.get("id"))
        if el.get("style"):
            inline_styles.append(el.get("style"))
        for attr in el.attrs:
            if attr.startswith("aria-") or attr == "role":
                aria_attrs[attr] += 1

    # collect colors from style tags & inline styles
    style_text = " ".join(s.string or "" for s in soup.find_all("style"))
    style_text += " " + " ".join(inline_styles)
    colors = Counter(HEX_RE.findall(style_text) + RGB_RE.findall(style_text) + HSL_RE.findall(style_text))

    # fonts (font-family usage)
    fonts = Counter(re.findall(r"font-family\s*:\s*([^;]+)", style_text))
    fonts = Counter({k.strip().strip("'\""): v for k, v in fonts.items()})

    # google fonts links
    google_fonts = [link.get("href") for link in soup.find_all("link") if link.get("href") and "fonts.googleapis" in link.get("href", "")]

    title = (soup.title.string.strip() if soup.title and soup.title.string else None)
    meta_desc = None
    md = soup.find("meta", attrs={"name": "description"})
    if md:
        meta_desc = md.get("content")

    images = [img.get("src") for img in soup.find_all("img") if img.get("src")][:30]
    headings = {f"h{i}": [h.get_text(strip=True)[:120] for h in soup.find_all(f"h{i}")][:15] for i in range(1, 7)}
    links_count = len(soup.find_all("a"))
    forms_count = len(soup.find_all("form"))
    buttons_count = len(soup.find_all("button"))
    scripts_count = len(soup.find_all("script"))
    stylesheets = [link.get("href") for link in soup.find_all("link", rel="stylesheet") if link.get("href")]

    # class buckets
    buckets: Dict[str, Counter] = {}
    for c in class_counter:
        buckets.setdefault(bucket_tailwind(c), Counter())[c] = class_counter[c]

    return {
        "source_url": source_url,
        "title": title,
        "meta_description": meta_desc,
        "total_elements": sum(tag_counter.values()),
        "tag_counts": dict(tag_counter.most_common(30)),
        "semantic_tag_counts": dict(semantic_count),
        "top_classes": dict(class_counter.most_common(60)),
        "class_buckets": {k: dict(v.most_common(25)) for k, v in buckets.items()},
        "unique_class_count": len(class_counter),
        "ids_sample": id_list[:30],
        "aria_usage": dict(aria_attrs),
        "color_tokens": dict(colors.most_common(30)),
        "font_families": dict(fonts.most_common(10)),
        "google_fonts_links": google_fonts,
        "stylesheets": stylesheets[:10],
        "headings": headings,
        "image_count": len(soup.find_all("img")),
        "images_sample": images,
        "links_count": links_count,
        "buttons_count": buttons_count,
        "forms_count": forms_count,
        "scripts_count": scripts_count,
        "inline_style_count": len(inline_styles),
    }


# ============ URL FETCH ============
async def fetch_url_html(url: str) -> str:
    async with httpx.AsyncClient(follow_redirects=True, timeout=20.0, headers={
        "User-Agent": "Mozilla/5.0 (EmergentExtractor/1.0)",
    }) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.text


# ============ SCREENSHOT ANALYSIS (Claude Vision) ============
VISION_SYSTEM_PROMPT = """You are a senior design system analyst. Given a screenshot of a website or UI, you extract ONLY strict JSON — no prose, no markdown fences.

Return this exact schema:
{
  "aesthetic": { "mood": "...", "archetype": "...", "era_reference": "...", "energy": "low|medium|high" },
  "color_palette": [ { "hex": "#RRGGBB", "role": "background|foreground|accent|muted|primary|secondary", "weight": "dominant|secondary|accent" } ],
  "typography": { "primary_style": "...", "heading_feel": "...", "body_feel": "...", "likely_fonts": ["..."] },
  "layout": { "grid_system": "...", "density": "sparse|balanced|dense", "alignment": "centered|left|asymmetric", "whitespace": "minimal|balanced|generous" },
  "visual_motifs": ["texture/pattern/illustration/etc."],
  "standout_elements": ["what makes this unique"],
  "cookie_cutter_risks": ["generic patterns present"],
  "anti_patterns_to_avoid": ["how to step away from generic"],
  "ai_prompt_brief": "A 2-3 sentence tight description another AI could use to recreate this aesthetic."
}
"""


async def _llm_send_with_retry(chat: LlmChat, msg: UserMessage, attempts: int = 1) -> str:
    """Send LLM message with error handling. Relies on litellm's internal retries.
    attempts=1 keeps total time bounded under typical edge timeouts."""
    try:
        return await chat.send_message(msg)
    except Exception as e:
        err = str(e)
        logger.warning("LLM call failed: %s", err)
        if "Budget has been exceeded" in err or "budget" in err.lower():
            raise HTTPException(
                status_code=402,
                detail="Emergent LLM Key budget exceeded. Please top up in Profile → Universal Key → Add Balance.",
            )
        raise HTTPException(status_code=502, detail=f"Upstream LLM unavailable: {err[:200]}")


async def analyze_screenshot(image_b64: str, label: Optional[str] = None) -> Dict[str, Any]:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"vision-{uuid.uuid4()}",
        system_message=VISION_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    msg = UserMessage(
        text=f"Analyze this screenshot{(' (label: ' + label + ')') if label else ''}. Return ONLY the JSON object defined in the system prompt. No prose.",
        file_contents=[ImageContent(image_base64=image_b64)],
    )
    raw = await _llm_send_with_retry(chat, msg)

    # strip accidental fences
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    # find first {
    idx = s.find("{")
    if idx > 0:
        s = s[idx:]
    try:
        parsed = json.loads(s)
    except Exception:
        parsed = {"_parse_error": True, "raw": raw}
    return parsed


# ============ DNA SYNTHESIS ============
DNA_SYSTEM_PROMPT = """You are an elite front-end design strategist. You receive structured extractions (React source analysis, HTML analysis, screenshot vision reports) and synthesize them into a rich, AI-consumable design DNA brief that another AI coding agent can use to build NEW projects with the same visual fingerprint — but specifically AVOIDING cookie-cutter AI patterns.

Return ONLY strict JSON (no prose/markdown) matching exactly:
{
  "project_fingerprint": {
    "one_liner": "...",
    "design_philosophy": "...",
    "archetype": "...",
    "signature_traits": ["..."]
  },
  "design_tokens": {
    "primary_colors": ["#..."],
    "neutral_colors": ["#..."],
    "accent_colors": ["#..."],
    "typography": { "headings": "...", "body": "...", "scale_feel": "..." },
    "spacing_rhythm": "...",
    "border_radius_language": "...",
    "shadow_language": "...",
    "motion_language": "..."
  },
  "component_patterns": {
    "buttons": "...",
    "cards": "...",
    "inputs": "...",
    "layout_containers": "..."
  },
  "ai_slop_avoidance": {
    "forbidden_patterns": ["..."],
    "required_distinctives": ["..."]
  },
  "ready_to_use_ai_prompt": "A full paragraph prompt another AI agent (like Cursor/Claude) can paste verbatim to build a new app in this exact style.",
  "ready_to_use_markdown_brief": "A longer markdown-formatted design brief with headings and bullet points."
}
"""


async def synthesize_dna(sources: List[Dict[str, Any]], project_name: str) -> Dict[str, Any]:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"dna-{uuid.uuid4()}",
        system_message=DNA_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    payload = {"project_name": project_name, "sources": sources}
    # truncate oversized payloads safely (per-source)
    payload_str = json.dumps(payload)
    if len(payload_str) > 60000:
        trimmed_sources = []
        for s in sources:
            data = s.get("data", {})
            # keep small top-level only if large
            data_str = json.dumps(data)
            if len(data_str) > 12000:
                # keep a condensed summary
                data = {k: v for k, v in data.items() if isinstance(v, (str, int, float, bool)) or (isinstance(v, (list, dict)) and len(json.dumps(v)) < 4000)}
            trimmed_sources.append({"kind": s["kind"], "label": s.get("label"), "data": data})
        payload = {"project_name": project_name, "sources": trimmed_sources}
        payload_str = json.dumps(payload)

    msg = UserMessage(
        text="Synthesize design DNA from the following extractions. Return ONLY the JSON object.\n\n" + payload_str,
    )
    raw = await _llm_send_with_retry(chat, msg)
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    idx = s.find("{")
    if idx > 0:
        s = s[idx:]
    try:
        return json.loads(s)
    except Exception:
        return {"_parse_error": True, "raw": raw}


# ============ DB HELPERS ============
async def save_extraction(kind: str, data: Dict[str, Any], label: Optional[str] = None) -> ExtractionRecord:
    rec = ExtractionRecord(kind=kind, label=label, data=data)
    doc = rec.model_dump()
    await db.extractions.insert_one(doc)
    return rec


# ============ ROUTES ============
@api_router.get("/")
async def root():
    return {"service": "emergent-extractor", "status": "ok"}


@api_router.post("/extract/react")
async def extract_react(payload: ReactExtractInput):
    if not payload.files:
        raise HTTPException(400, "No files provided")
    per_file = [extract_react_file(f["name"], f["content"]) for f in payload.files]
    agg = aggregate_react(per_file)
    rec = await save_extraction("react", agg, label=f"{len(payload.files)} file(s)")
    return {"id": rec.id, "kind": "react", "data": agg}


@api_router.post("/extract/html")
async def extract_html(payload: HtmlExtractInput):
    data = extract_html_data(payload.html, payload.source_url)
    rec = await save_extraction("html", data, label=payload.source_url or data.get("title"))
    return {"id": rec.id, "kind": "html", "data": data}


@api_router.post("/extract/url")
async def extract_url(payload: UrlExtractInput):
    try:
        html = await fetch_url_html(payload.url)
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch URL: {e}")
    data = extract_html_data(html, payload.url)
    rec = await save_extraction("url", data, label=payload.url)
    return {"id": rec.id, "kind": "url", "data": data, "html_length": len(html)}


@api_router.post("/extract/screenshot")
async def extract_screenshot(payload: ScreenshotExtractInput):
    # normalize: decode, ensure PNG/JPEG, resize if huge
    try:
        raw_bytes = base64.b64decode(payload.image_base64)
        img = Image.open(io.BytesIO(raw_bytes))
        if getattr(img, "is_animated", False):
            img.seek(0)
        img = img.convert("RGB")
        # cap dimensions
        max_side = 1600
        if max(img.size) > max_side:
            ratio = max_side / max(img.size)
            img = img.resize((int(img.size[0]*ratio), int(img.size[1]*ratio)))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        clean_b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        raise HTTPException(400, f"Invalid image: {e}")

    analysis = await analyze_screenshot(clean_b64, payload.label)
    rec = await save_extraction("screenshot", analysis, label=payload.label or "screenshot")
    return {"id": rec.id, "kind": "screenshot", "data": analysis}


@api_router.post("/analyze/dna")
async def analyze_dna(payload: CombinedAnalyzeInput):
    if not payload.extraction_ids:
        raise HTTPException(400, "No extraction_ids provided")
    sources = []
    async for doc in db.extractions.find({"id": {"$in": payload.extraction_ids}}, {"_id": 0}):
        sources.append({"kind": doc["kind"], "label": doc.get("label"), "data": doc["data"]})
    if not sources:
        raise HTTPException(404, "No matching extractions found")
    dna = await synthesize_dna(sources, payload.project_name or "Untitled Project")
    rec = await save_extraction("dna", dna, label=payload.project_name)
    return {"id": rec.id, "kind": "dna", "data": dna, "source_count": len(sources)}


@api_router.get("/extractions")
async def list_extractions(limit: int = 20):
    docs = await db.extractions.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # strip heavy data field for list view
    return [{"id": d["id"], "kind": d["kind"], "label": d.get("label"), "created_at": d["created_at"]} for d in docs]


@api_router.get("/extractions/{ext_id}")
async def get_extraction(ext_id: str):
    doc = await db.extractions.find_one({"id": ext_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@api_router.delete("/extractions/{ext_id}")
async def delete_extraction(ext_id: str):
    res = await db.extractions.delete_one({"id": ext_id})
    return {"deleted": res.deleted_count}


# ============ URL SCREENSHOT (PLAYWRIGHT) ============
async def capture_url_screenshot(
    url: str,
    full_page: bool = True,
    viewport_width: int = 1440,
    viewport_height: int = 900,
) -> bytes:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            context = await browser.new_context(
                viewport={"width": viewport_width, "height": viewport_height},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="networkidle", timeout=25000)
            except Exception:
                # Fallback: wait for domcontentloaded if networkidle times out (SPAs)
                await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1200)
            png_bytes = await page.screenshot(full_page=full_page, type="png")
            return png_bytes
        finally:
            await browser.close()


@api_router.post("/screenshot/url")
async def screenshot_from_url(payload: UrlScreenshotInput):
    target = payload.url.strip()
    if not re.match(r"^https?://", target, re.I):
        target = "https://" + target
    try:
        png_bytes = await capture_url_screenshot(
            target,
            full_page=payload.full_page,
            viewport_width=payload.viewport_width,
            viewport_height=payload.viewport_height,
        )
    except Exception as e:
        raise HTTPException(502, f"Screenshot capture failed: {e}")

    # Normalize via PIL (resize if huge)
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    max_side = 1600
    if max(img.size) > max_side:
        ratio = max_side / max(img.size)
        img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()

    analysis = await analyze_screenshot(b64, payload.label or target)
    analysis["_source_url"] = target
    rec = await save_extraction("screenshot", analysis, label=payload.label or target)
    return {
        "id": rec.id,
        "kind": "screenshot",
        "data": analysis,
        "preview_base64": b64,
        "source_url": target,
    }


# ============ PROJECTS ============
def _project_doc_to_out(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "extraction_ids": doc.get("extraction_ids", []),
        "dna_id": doc.get("dna_id"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


@api_router.post("/projects")
async def create_project(payload: ProjectCreateInput):
    if not payload.name.strip():
        raise HTTPException(400, "Project name required")
    proj = Project(name=payload.name.strip())
    await db.projects.insert_one(proj.model_dump())
    return _project_doc_to_out(proj.model_dump())


@api_router.get("/projects")
async def list_projects():
    docs = await db.projects.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return [_project_doc_to_out(d) for d in docs]


@api_router.get("/projects/{pid}")
async def get_project(pid: str):
    doc = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Project not found")
    # populate extractions + dna
    ext_ids = doc.get("extraction_ids", [])
    extractions: List[Dict[str, Any]] = []
    if ext_ids:
        async for e in db.extractions.find({"id": {"$in": ext_ids}}, {"_id": 0}):
            extractions.append(e)
        # preserve order per doc.extraction_ids
        order = {eid: i for i, eid in enumerate(ext_ids)}
        extractions.sort(key=lambda x: order.get(x["id"], 999))

    dna = None
    if doc.get("dna_id"):
        dna = await db.extractions.find_one({"id": doc["dna_id"]}, {"_id": 0})

    return {**_project_doc_to_out(doc), "extractions": extractions, "dna": dna}


@api_router.patch("/projects/{pid}")
async def update_project(pid: str, payload: ProjectUpdateInput):
    doc = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Project not found")

    ext_ids = list(doc.get("extraction_ids", []))
    update: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if payload.name is not None and payload.name.strip():
        update["name"] = payload.name.strip()

    if payload.add_extraction_ids:
        for x in payload.add_extraction_ids:
            if x not in ext_ids:
                ext_ids.append(x)
    if payload.remove_extraction_ids:
        ext_ids = [x for x in ext_ids if x not in payload.remove_extraction_ids]
    if payload.add_extraction_ids or payload.remove_extraction_ids:
        update["extraction_ids"] = ext_ids

    if payload.dna_id is not None:
        update["dna_id"] = payload.dna_id or None

    await db.projects.update_one({"id": pid}, {"$set": update})
    new_doc = await db.projects.find_one({"id": pid}, {"_id": 0})
    return _project_doc_to_out(new_doc)


@api_router.delete("/projects/{pid}")
async def delete_project(pid: str):
    res = await db.projects.delete_one({"id": pid})
    return {"deleted": res.deleted_count}


@api_router.post("/projects/{pid}/analyze-dna")
async def analyze_project_dna(pid: str):
    doc = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Project not found")
    ext_ids = doc.get("extraction_ids", [])
    if not ext_ids:
        raise HTTPException(400, "Project has no extractions")

    sources = []
    async for e in db.extractions.find({"id": {"$in": ext_ids}}, {"_id": 0}):
        if e["kind"] == "dna":
            continue
        sources.append({"kind": e["kind"], "label": e.get("label"), "data": e["data"]})
    if not sources:
        raise HTTPException(400, "No non-DNA sources to synthesize from")

    dna = await synthesize_dna(sources, doc["name"])
    rec = await save_extraction("dna", dna, label=f"DNA // {doc['name']}")
    await db.projects.update_one(
        {"id": pid},
        {"$set": {"dna_id": rec.id, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"id": rec.id, "kind": "dna", "data": dna, "project_id": pid, "source_count": len(sources)}


# ============ DNA DIFF ============
DIFF_SYSTEM_PROMPT = """You compare two design DNA reports and produce a structured, brutally honest diff.

Return ONLY strict JSON (no prose/markdown) matching:
{
  "summary_one_liner": "...",
  "overall_similarity": 0,
  "color_diff": { "shared": ["#..."], "only_a": ["#..."], "only_b": ["#..."], "verdict": "..." },
  "typography_diff": { "a_feel": "...", "b_feel": "...", "verdict": "..." },
  "layout_diff": { "a": "...", "b": "...", "verdict": "..." },
  "motion_diff": { "a": "...", "b": "...", "verdict": "..." },
  "philosophy_diff": { "a": "...", "b": "...", "verdict": "..." },
  "shared_signatures": ["..."],
  "divergent_signatures": ["..."],
  "merge_recommendation": "A concrete paragraph: how an AI agent could fuse both into a new distinctive system.",
  "ai_slop_alignment": { "a_risk": "low|medium|high", "b_risk": "low|medium|high", "notes": "..." }
}
overall_similarity is 0-100.
"""


@api_router.post("/dna/diff")
async def dna_diff(payload: DnaDiffInput):
    a = await db.extractions.find_one({"id": payload.dna_a_id, "kind": "dna"}, {"_id": 0})
    b = await db.extractions.find_one({"id": payload.dna_b_id, "kind": "dna"}, {"_id": 0})
    if not a or not b:
        raise HTTPException(404, "One or both DNA records not found")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"diff-{uuid.uuid4()}",
        system_message=DIFF_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    body = {
        "dna_a": {"label": a.get("label"), "data": a["data"]},
        "dna_b": {"label": b.get("label"), "data": b["data"]},
    }
    msg = UserMessage(
        text="Compare these two DNA reports. Return ONLY the JSON object.\n\n" + json.dumps(body)[:60000],
    )
    raw = await _llm_send_with_retry(chat, msg)
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    idx = s.find("{")
    if idx > 0:
        s = s[idx:]
    try:
        parsed = json.loads(s)
    except Exception:
        parsed = {"_parse_error": True, "raw": raw}

    return {
        "dna_a_id": payload.dna_a_id,
        "dna_b_id": payload.dna_b_id,
        "a_label": a.get("label"),
        "b_label": b.get("label"),
        "diff": parsed,
    }


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_setup():
    try:
        await db.extractions.create_index("id", unique=True)
        await db.extractions.create_index("created_at")
        await db.projects.create_index("id", unique=True)
        await db.projects.create_index("updated_at")
    except Exception as e:
        logger.warning("Index creation skipped: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
