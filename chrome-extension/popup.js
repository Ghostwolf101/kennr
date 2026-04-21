/* Emergent Extractor — popup logic */

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg, cls = "loading", html = false) {
    statusEl.className = `status ${cls}`;
    if (html) statusEl.innerHTML = msg;
    else statusEl.textContent = msg;
    statusEl.style.display = "block";
}

async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function loadSettings() {
    const stored = await chrome.storage.sync.get([
        "backendUrl",
        "projectName",
        "fullPage",
    ]);
    if (stored.backendUrl) $("backend-url").value = stored.backendUrl;
    if (stored.projectName) $("project-name").value = stored.projectName;
    if (stored.fullPage !== undefined) $("full-page").checked = !!stored.fullPage;
}

async function saveSettings() {
    await chrome.storage.sync.set({
        backendUrl: $("backend-url").value.trim(),
        projectName: $("project-name").value.trim(),
        fullPage: $("full-page").checked,
    });
}

function apiBase() {
    let u = $("backend-url").value.trim();
    if (!u) return null;
    u = u.replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u;
}

async function postJSON(path, body) {
    const base = apiBase();
    if (!base) throw new Error("Set backend URL first");
    const r = await fetch(`${base}/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        let detail = r.statusText;
        try {
            const j = await r.json();
            detail = j.detail || JSON.stringify(j);
        } catch {}
        throw new Error(`HTTP ${r.status}: ${detail}`);
    }
    return r.json();
}

async function patchJSON(path, body) {
    const base = apiBase();
    const r = await fetch(`${base}/api${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

async function ensureProject() {
    const name = $("project-name").value.trim();
    if (!name) return null;
    const base = apiBase();
    // list then find or create
    const lr = await fetch(`${base}/api/projects`);
    const list = await lr.json();
    const existing = list.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;
    const created = await postJSON("/projects", { name });
    return created.id;
}

async function grabOuterHTML(tabId) {
    const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
            html: document.documentElement.outerHTML,
            title: document.title,
            url: location.href,
        }),
    });
    return result[0].result;
}

async function captureVisibleShot() {
    // captureVisibleTab returns a data URL (viewport only)
    const dataUrl = await new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, (url) => {
            if (chrome.runtime.lastError)
                reject(new Error(chrome.runtime.lastError.message));
            else resolve(url);
        });
    });
    return dataUrl.replace(/^data:image\/png;base64,/, "");
}

async function runHtml() {
    setStatus("capturing outerHTML…", "loading");
    await saveSettings();
    const tab = await getCurrentTab();
    const { html, title, url } = await grabOuterHTML(tab.id);
    setStatus("sending to extractor…", "loading");

    const res = await postJSON("/extract/html", { html, source_url: url });

    const projectId = await ensureProject();
    if (projectId) {
        await patchJSON(`/projects/${projectId}`, {
            add_extraction_ids: [res.id],
        });
    }

    const base = apiBase();
    setStatus(
        `✓ HTML parsed (${title}) — <a href="${base}" target="_blank">open dashboard</a>`,
        "ok",
        true,
    );
}

async function runScreenshot() {
    setStatus("capturing…", "loading");
    await saveSettings();
    const tab = await getCurrentTab();

    const fullPage = $("full-page").checked;
    let res;
    if (fullPage) {
        // Use server-side playwright for full-page capture
        res = await postJSON("/screenshot/url", {
            url: tab.url,
            full_page: true,
            label: tab.title,
        });
    } else {
        const b64 = await captureVisibleShot();
        res = await postJSON("/extract/screenshot", {
            image_base64: b64,
            mime_type: "image/png",
            label: tab.title,
        });
    }

    const projectId = await ensureProject();
    if (projectId) {
        await patchJSON(`/projects/${projectId}`, {
            add_extraction_ids: [res.id],
        });
    }

    const base = apiBase();
    setStatus(
        `✓ screenshot analyzed — <a href="${base}" target="_blank">open dashboard</a>`,
        "ok",
        true,
    );
}

async function runBoth() {
    setStatus("capturing html + screenshot…", "loading");
    await saveSettings();
    const tab = await getCurrentTab();
    const projectId = await ensureProject();

    // HTML first (fast)
    const { html, url: pageUrl } = await grabOuterHTML(tab.id);
    const htmlRes = await postJSON("/extract/html", {
        html,
        source_url: pageUrl,
    });

    // Then screenshot
    const fullPage = $("full-page").checked;
    let shotRes;
    if (fullPage) {
        shotRes = await postJSON("/screenshot/url", {
            url: tab.url,
            full_page: true,
            label: tab.title,
        });
    } else {
        const b64 = await captureVisibleShot();
        shotRes = await postJSON("/extract/screenshot", {
            image_base64: b64,
            mime_type: "image/png",
            label: tab.title,
        });
    }

    if (projectId) {
        await patchJSON(`/projects/${projectId}`, {
            add_extraction_ids: [htmlRes.id, shotRes.id],
        });
    }

    const base = apiBase();
    setStatus(
        `✓ captured both — <a href="${base}" target="_blank">open dashboard</a>`,
        "ok",
        true,
    );
}

function guard(fn) {
    return async () => {
        try {
            [
                "capture-html",
                "capture-shot",
                "capture-both",
            ].forEach((id) => ($(id).disabled = true));
            await fn();
        } catch (e) {
            console.error(e);
            setStatus("× " + (e.message || "failed"), "error");
        } finally {
            [
                "capture-html",
                "capture-shot",
                "capture-both",
            ].forEach((id) => ($(id).disabled = false));
        }
    };
}

async function init() {
    await loadSettings();
    const tab = await getCurrentTab();
    $("tab-title").textContent = tab.title || "—";
    $("tab-url").textContent = tab.url || "—";

    $("capture-html").addEventListener("click", guard(runHtml));
    $("capture-shot").addEventListener("click", guard(runScreenshot));
    $("capture-both").addEventListener("click", guard(runBoth));

    // Save on change
    ["backend-url", "project-name"].forEach((id) =>
        $(id).addEventListener("change", saveSettings),
    );
    $("full-page").addEventListener("change", saveSettings);
}

init();
