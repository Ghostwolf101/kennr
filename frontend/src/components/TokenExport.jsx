import React, { useState } from "react";
import { toast } from "sonner";
import { Download, Copy, Palette, X } from "@phosphor-icons/react";
import { BrutalCard, BrutalButton, Overline, Tag } from "./ui-brutal";
import { API } from "@/lib/api";

const TABS = [
    { id: "css", label: "CSS vars", ext: "css" },
    { id: "tailwind_config_js", label: "Tailwind", ext: "js" },
    { id: "scss", label: "SCSS", ext: "scss" },
    { id: "markdown_legend", label: "Markdown", ext: "md" },
];

export default function TokenExport({ extractionId, label, onClose }) {
    const [tab, setTab] = useState("css");
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/tokens/export/${extractionId}`);
            if (!r.ok) throw new Error((await r.json()).detail || r.status);
            const d = await r.json();
            setPayload(d);
        } catch (e) {
            toast.error(e.message || "Export failed");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [extractionId]);

    const content = payload?.[tab] || "";
    const ext = TABS.find((t) => t.id === tab)?.ext || "txt";
    const filename = `tokens-${(label || extractionId).replace(/\s+/g, "-").slice(0, 40)}.${ext}`;

    const copy = () => {
        navigator.clipboard.writeText(content);
        toast.success("Copied");
    };
    const download = () => {
        const blob = new Blob([content], { type: "text/plain" });
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(u);
    };

    return (
        <BrutalCard className="p-0" data-testid="token-export-panel">
            <div className="flex items-center justify-between px-4 py-3 bg-black text-white brutal-border border-l-0 border-r-0 border-t-0">
                <div className="flex items-center gap-2">
                    <Palette size={16} />
                    <span
                        className="font-display font-black text-lg"
                        style={{ letterSpacing: "-0.02em" }}
                    >
                        TOKEN EXPORT
                    </span>
                    <Tag tone="accent">{payload?.source_kind || "…"}</Tag>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="hover:text-[#FF3B30]"
                        data-testid="close-token-export-btn"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-4 brutal-border border-l-0 border-r-0 border-t-0">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`p-3 font-mono text-[11px] uppercase tracking-wider brutal-border border-t-0 border-l-0 last:border-r-0 border-b-0 ${
                            tab === t.id
                                ? "bg-[#FFDF00] text-black"
                                : "bg-white hover:bg-[#F0F0F0]"
                        }`}
                        data-testid={`token-tab-${t.id}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="p-4">
                {loading && (
                    <div className="font-mono text-xs text-[#555]">
                        loading…
                    </div>
                )}
                {!loading && payload && (
                    <>
                        <div className="flex items-center justify-between mb-2">
                            <Overline>{filename}</Overline>
                            <div className="flex gap-2">
                                <BrutalButton
                                    variant="default"
                                    onClick={copy}
                                    className="!px-3 !py-1 !text-[10px]"
                                    data-testid="token-copy-btn"
                                >
                                    <Copy size={12} /> copy
                                </BrutalButton>
                                <BrutalButton
                                    variant="primary"
                                    onClick={download}
                                    className="!px-3 !py-1 !text-[10px]"
                                    data-testid="token-download-btn"
                                >
                                    <Download size={12} /> download
                                </BrutalButton>
                            </div>
                        </div>
                        <pre
                            className="brutal-border p-3 bg-[#F0F0F0] font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-96 overflow-auto"
                            data-testid="token-preview"
                        >
                            {content}
                        </pre>
                    </>
                )}
            </div>
        </BrutalCard>
    );
}
