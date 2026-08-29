# Security Incident Note — 2026-08-29

Full cross-org report: [`auernyx-agent-mk2/docs/SECURITY_INCIDENT_2026-08-29.md`](https://github.com/Auernyx-com/auernyx-agent-mk2/blob/main/docs/SECURITY_INCIDENT_2026-08-29.md)
Backend-side detail: [`kennr-worker/docs/SECURITY_INCIDENT_2026-08-29.md`](https://github.com/Ghostwolf101/kennr-worker/blob/main/docs/SECURITY_INCIDENT_2026-08-29.md)

## What happened here specifically

This extension is published publicly, but the backend it talks to (`kennr-worker`) had no authentication at all and no per-user data isolation — any real installer of this extension could have listed, read, or deleted any other installer's extracted data. Confirmed 0 real users at the time this was found; no evidence anyone was actually affected.

## Disposition

`popup.html` gained an "admin token" field; `popup.js` now sends it as `x-admin-token` on every request (stored via `chrome.storage.sync`, same as the other settings). This is required for the extension to work at all now that the backend fails closed without it. If you're reading this because the extension stopped working: get the current token value from `/home/echostation/.wyerd-trader-keys` (`KENNR_ADMIN_TOKEN`) and paste it into the extension's settings.
