// Emergent Extractor — background service worker (Manifest V3)
// Minimal: just forwards action click in case popup fails; real work happens in popup.js.

chrome.runtime.onInstalled.addListener(() => {
    console.log("Emergent Extractor installed");
});
