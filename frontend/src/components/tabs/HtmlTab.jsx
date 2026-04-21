import React, { useState } from "react";
import { toast } from "sonner";
import { Code } from "@phosphor-icons/react";
import {
    BrutalCard,
    BrutalButton,
    BrutalTextarea,
    BrutalInput,
    BrutalLoader,
    Overline,
    Tag,
} from "../ui-brutal";
import { extractHtml } from "@/lib/api";

export default function HtmlTab({ onExtracted }) {
    const [html, setHtml] = useState("");
    const [src, setSrc] = useState("");
    const [loading, setLoading] = useState(false);

    const run = async () => {
        if (!html.trim()) {
            toast.error("Paste some HTML first");
            return;
        }
        setLoading(true);
        try {
            const res = await extractHtml(html, src || null);
            toast.success("HTML parsed");
            onExtracted(res);
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "Extraction failed",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <BrutalCard className="p-6" data-testid="html-tab">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <Overline>input / rendered html</Overline>
                    <h3
                        className="font-display font-black text-2xl leading-none mt-1"
                        style={{ letterSpacing: "-0.03em" }}
                    >
                        PASTE outerHTML
                    </h3>
                </div>
                <Tag tone="accent">B</Tag>
            </div>

            <Overline className="mb-1">source url (optional)</Overline>
            <BrutalInput
                placeholder="https://example.com"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                data-testid="html-source-input"
            />

            <Overline className="mt-4 mb-1">html</Overline>
            <BrutalTextarea
                rows={12}
                placeholder="<!doctype html> ... paste post-JS outerHTML here ..."
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                data-testid="html-textarea"
            />
            <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-[#555]">
                <span>
                    <Code size={12} className="inline mr-1" />
                    {html.length.toLocaleString()} chars ·{" "}
                    {html.split("\n").length} lines
                </span>
                <span>tip: DevTools → Elements → right-click &lt;html&gt; → Copy outerHTML</span>
            </div>

            <div className="mt-5 flex items-center gap-3">
                <BrutalButton
                    variant="primary"
                    onClick={run}
                    disabled={loading || !html.trim()}
                    data-testid="extract-html-btn"
                >
                    {loading ? (
                        <BrutalLoader label="parsing" />
                    ) : (
                        "Run extraction →"
                    )}
                </BrutalButton>
                <div className="font-mono text-[11px] text-[#555]">
                    pulls: DOM tree · classes · colors · fonts · semantics · a11y
                </div>
            </div>
        </BrutalCard>
    );
}
