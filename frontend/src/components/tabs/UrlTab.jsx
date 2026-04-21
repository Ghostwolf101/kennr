import React, { useState } from "react";
import { toast } from "sonner";
import { Globe, Camera } from "@phosphor-icons/react";
import {
    BrutalCard,
    BrutalButton,
    BrutalInput,
    BrutalLoader,
    Overline,
    Tag,
} from "../ui-brutal";
import { extractUrl, screenshotUrl } from "@/lib/api";

export default function UrlTab({ onExtracted }) {
    const [url, setUrl] = useState("");
    const [mode, setMode] = useState("html"); // html | screenshot
    const [fullPage, setFullPage] = useState(true);
    const [loading, setLoading] = useState(false);

    const normalizeUrl = (u) => {
        let t = u.trim();
        if (!t) return null;
        if (!/^https?:\/\//i.test(t)) t = "https://" + t;
        return t;
    };

    const run = async () => {
        const target = normalizeUrl(url);
        if (!target) {
            toast.error("Enter a URL");
            return;
        }

        setLoading(true);
        try {
            if (mode === "html") {
                const res = await extractUrl(target);
                toast.success("URL fetched & parsed");
                onExtracted(res);
            } else {
                const res = await screenshotUrl(target, fullPage, target);
                toast.success("Screenshot captured & analyzed");
                onExtracted(res);
            }
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "Request failed",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <BrutalCard className="p-6" data-testid="url-tab">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <Overline>input / live url</Overline>
                    <h3
                        className="font-display font-black text-2xl leading-none mt-1"
                        style={{ letterSpacing: "-0.03em" }}
                    >
                        FETCH FROM URL
                    </h3>
                </div>
                <Tag tone="secondary">D</Tag>
            </div>

            <Overline className="mb-1">mode</Overline>
            <div className="grid grid-cols-2 brutal-border mb-4">
                <button
                    onClick={() => setMode("html")}
                    className={`p-3 font-mono text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 brutal-border border-t-0 border-l-0 border-b-0 ${
                        mode === "html"
                            ? "bg-black text-white"
                            : "bg-white hover:bg-[#F0F0F0]"
                    }`}
                    data-testid="url-mode-html"
                >
                    <Globe size={14} /> HTML parse
                </button>
                <button
                    onClick={() => setMode("screenshot")}
                    className={`p-3 font-mono text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 brutal-border border-t-0 border-b-0 ${
                        mode === "screenshot"
                            ? "bg-black text-white"
                            : "bg-white hover:bg-[#F0F0F0]"
                    }`}
                    data-testid="url-mode-screenshot"
                >
                    <Camera size={14} /> Auto-screenshot
                </button>
            </div>

            <Overline className="mb-1">url</Overline>
            <div className="flex gap-0">
                <div className="bg-black text-white px-3 flex items-center brutal-border border-r-0 font-mono text-xs">
                    <Globe size={14} />
                </div>
                <BrutalInput
                    placeholder="emergent.sh"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && run()}
                    className="flex-1"
                    data-testid="url-input"
                />
            </div>

            {mode === "screenshot" && (
                <div className="mt-3">
                    <label className="flex items-center gap-2 font-mono text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fullPage}
                            onChange={(e) => setFullPage(e.target.checked)}
                            className="brutal-border w-4 h-4"
                            data-testid="url-fullpage-checkbox"
                        />
                        <span>full-page capture (scroll &amp; stitch)</span>
                    </label>
                </div>
            )}

            <div className="mt-3 font-mono text-[11px] text-[#555]">
                {mode === "html"
                    ? "server-side fetch (no JS execution)"
                    : "playwright headless chrome → vision analysis via claude"}
            </div>

            <div className="mt-5 flex items-center gap-3">
                <BrutalButton
                    variant="primary"
                    onClick={run}
                    disabled={loading || !url.trim()}
                    data-testid="extract-url-btn"
                >
                    {loading ? (
                        <BrutalLoader
                            label={
                                mode === "screenshot"
                                    ? "capturing"
                                    : "fetching"
                            }
                        />
                    ) : mode === "screenshot" ? (
                        <>
                            <Camera size={14} /> Capture &amp; analyze →
                        </>
                    ) : (
                        "Fetch & extract →"
                    )}
                </BrutalButton>
            </div>
        </BrutalCard>
    );
}
