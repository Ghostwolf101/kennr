import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API,
    headers: { "Content-Type": "application/json" },
});

export const extractReact = (files) =>
    api.post("/extract/react", { files }).then((r) => r.data);

export const extractHtml = (html, source_url = null) =>
    api.post("/extract/html", { html, source_url }).then((r) => r.data);

export const extractUrl = (url) =>
    api.post("/extract/url", { url }).then((r) => r.data);

export const extractScreenshot = (image_base64, mime_type, label) =>
    api
        .post("/extract/screenshot", { image_base64, mime_type, label })
        .then((r) => r.data);

export const analyzeDna = (extraction_ids, project_name) =>
    api
        .post("/analyze/dna", { extraction_ids, project_name })
        .then((r) => r.data);

export const listExtractions = () =>
    api.get("/extractions").then((r) => r.data);

export const getExtraction = (id) =>
    api.get(`/extractions/${id}`).then((r) => r.data);

export const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            const comma = result.indexOf(",");
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

export const fileToText = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
