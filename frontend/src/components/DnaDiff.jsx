import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    GitDiff,
    Warning,
    CheckCircle,
    X,
} from "@phosphor-icons/react";
import {
    BrutalCard,
    BrutalButton,
    BrutalLoader,
    Overline,
    Tag,
} from "./ui-brutal";
import { listExtractions, dnaDiff } from "@/lib/api";

function isHex(s) {
    return /^#[0-9a-fA-F]{3,8}$/.test(s);
}

function Swatches({ colors }) {
    if (!colors || !colors.length)
        return <div className="text-xs text-[#999]">—</div>;
    return (
        <div className="flex flex-wrap gap-1">
            {colors.slice(0, 12).map((c, i) => (
                <div
                    key={i}
                    title={c}
                    className="w-6 h-6 brutal-border"
                    style={{ background: isHex(c) ? c : "#fff" }}
                />
            ))}
        </div>
    );
}

function DiffRow({ title, a, b, verdict }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr] gap-0 brutal-border border-l-0 border-r-0 border-t-0">
            <div className="p-3 bg-black text-white brutal-border border-t-0 border-l-0 border-b-0">
                <Overline className="text-[#FFDF00]">{title}</Overline>
                {verdict && (
                    <div className="mt-2 text-[11px] font-mono leading-snug">
                        {verdict}
                    </div>
                )}
            </div>
            <div className="p-3 brutal-border border-t-0 border-l-0 border-b-0">
                <Tag tone="primary">A</Tag>
                <div className="mt-2 font-mono text-xs leading-relaxed">
                    {a}
                </div>
            </div>
            <div className="p-3">
                <Tag tone="secondary">B</Tag>
                <div className="mt-2 font-mono text-xs leading-relaxed">
                    {b}
                </div>
            </div>
        </div>
    );
}

export default function DnaDiff({ onClose }) {
    const [dnas, setDnas] = useState([]);
    const [aId, setAId] = useState("");
    const [bId, setBId] = useState("");
    const [loading, setLoading] = useState(false);
    const [diff, setDiff] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const all = await listExtractions();
                const dnaOnly = all.filter((x) => x.kind === "dna");
                setDnas(dnaOnly);
                if (dnaOnly.length >= 1) setAId(dnaOnly[0].id);
                if (dnaOnly.length >= 2) setBId(dnaOnly[1].id);
            } catch (e) {
                // silent
            }
        })();
    }, []);

    const run = async () => {
        if (!aId || !bId) {
            toast.error("Pick two DNA records");
            return;
        }
        if (aId === bId) {
            toast.error("Pick two different DNAs");
            return;
        }
        setLoading(true);
        try {
            const res = await dnaDiff(aId, bId);
            setDiff(res);
            toast.success("Diff ready");
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "Diff failed",
            );
        } finally {
            setLoading(false);
        }
    };

    const d = diff?.diff;

    return (
        <BrutalCard className="p-0" data-testid="dna-diff-panel">
            <div className="flex items-center justify-between px-4 py-3 bg-black text-white brutal-border border-l-0 border-r-0 border-t-0">
                <div className="flex items-center gap-2">
                    <GitDiff size={16} />
                    <span
                        className="font-display font-black text-lg"
                        style={{ letterSpacing: "-0.02em" }}
                    >
                        DNA DIFF
                    </span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="hover:text-[#FF3B30]"
                        data-testid="close-diff-btn"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] items-end gap-3">
                <div>
                    <Overline className="mb-1">dna a</Overline>
                    <select
                        value={aId}
                        onChange={(e) => setAId(e.target.value)}
                        className="w-full brutal-border px-3 py-2 font-mono text-xs focus:outline-none focus:border-[#FF3B30]"
                        data-testid="diff-a-select"
                    >
                        <option value="">— pick —</option>
                        {dnas.map((d) => (
                            <option key={d.id} value={d.id}>
                                {(d.label || d.id.slice(0, 8)) +
                                    " · " +
                                    d.created_at.slice(5, 16)}
                            </option>
                        ))}
                    </select>
                </div>
                <span className="font-display font-black text-2xl text-center hidden md:block">
                    VS
                </span>
                <div>
                    <Overline className="mb-1">dna b</Overline>
                    <select
                        value={bId}
                        onChange={(e) => setBId(e.target.value)}
                        className="w-full brutal-border px-3 py-2 font-mono text-xs focus:outline-none focus:border-[#FF3B30]"
                        data-testid="diff-b-select"
                    >
                        <option value="">— pick —</option>
                        {dnas.map((d) => (
                            <option key={d.id} value={d.id}>
                                {(d.label || d.id.slice(0, 8)) +
                                    " · " +
                                    d.created_at.slice(5, 16)}
                            </option>
                        ))}
                    </select>
                </div>
                <BrutalButton
                    variant="primary"
                    onClick={run}
                    disabled={loading || !aId || !bId || aId === bId}
                    data-testid="run-diff-btn"
                >
                    {loading ? <BrutalLoader label="diffing" /> : "Diff →"}
                </BrutalButton>
            </div>

            {dnas.length < 2 && (
                <div className="p-4 brutal-border border-l-0 border-r-0 border-b-0 bg-[#FFDF00]">
                    <div className="flex items-center gap-2 font-mono text-xs">
                        <Warning size={14} />
                        Need ≥2 saved DNA records to diff. Synthesize a DNA
                        from different projects or extraction groups first.
                    </div>
                </div>
            )}

            {diff && !d?._parse_error && (
                <div>
                    <div className="px-4 py-3 bg-[#FF3B30] text-white brutal-border border-l-0 border-r-0 border-b-0">
                        <Overline className="text-white">
                            summary
                        </Overline>
                        <div
                            className="mt-1 font-display font-black text-xl md:text-2xl leading-tight"
                            style={{ letterSpacing: "-0.03em" }}
                        >
                            {d?.summary_one_liner}
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                            <Tag tone="accent">
                                similarity {d?.overall_similarity ?? "?"}%
                            </Tag>
                            <div className="flex-1 h-3 bg-black/30 brutal-border">
                                <div
                                    className="h-full bg-[#FFDF00]"
                                    style={{
                                        width: `${Math.min(
                                            100,
                                            Math.max(0, d?.overall_similarity || 0),
                                        )}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {d?.color_diff && (
                        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr] gap-0 brutal-border border-l-0 border-r-0 border-t-0">
                            <div className="p-3 bg-black text-white">
                                <Overline className="text-[#FFDF00]">
                                    color
                                </Overline>
                                <div className="mt-2 text-[11px] font-mono leading-snug">
                                    {d.color_diff.verdict}
                                </div>
                            </div>
                            <div className="p-3 brutal-border border-t-0 border-l-0 border-b-0">
                                <Overline className="mb-1">only A</Overline>
                                <Swatches colors={d.color_diff.only_a} />
                            </div>
                            <div className="p-3">
                                <Overline className="mb-1">only B</Overline>
                                <Swatches colors={d.color_diff.only_b} />
                                {d.color_diff.shared?.length > 0 && (
                                    <>
                                        <Overline className="mt-3 mb-1">
                                            shared
                                        </Overline>
                                        <Swatches colors={d.color_diff.shared} />
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {d?.typography_diff && (
                        <DiffRow
                            title="typography"
                            a={d.typography_diff.a_feel}
                            b={d.typography_diff.b_feel}
                            verdict={d.typography_diff.verdict}
                        />
                    )}
                    {d?.layout_diff && (
                        <DiffRow
                            title="layout"
                            a={d.layout_diff.a}
                            b={d.layout_diff.b}
                            verdict={d.layout_diff.verdict}
                        />
                    )}
                    {d?.motion_diff && (
                        <DiffRow
                            title="motion"
                            a={d.motion_diff.a}
                            b={d.motion_diff.b}
                            verdict={d.motion_diff.verdict}
                        />
                    )}
                    {d?.philosophy_diff && (
                        <DiffRow
                            title="philosophy"
                            a={d.philosophy_diff.a}
                            b={d.philosophy_diff.b}
                            verdict={d.philosophy_diff.verdict}
                        />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 brutal-border border-l-0 border-r-0 border-t-0">
                        <div className="p-4 brutal-border border-t-0 border-l-0 border-b-0">
                            <Overline className="mb-2">
                                <CheckCircle size={12} className="inline mr-1" />
                                shared signatures
                            </Overline>
                            <ul className="space-y-1 font-mono text-xs">
                                {(d?.shared_signatures || []).map((s, i) => (
                                    <li key={i}>› {s}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-4">
                            <Overline className="mb-2">
                                <GitDiff size={12} className="inline mr-1" />
                                divergent signatures
                            </Overline>
                            <ul className="space-y-1 font-mono text-xs">
                                {(d?.divergent_signatures || []).map((s, i) => (
                                    <li key={i}>› {s}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {d?.merge_recommendation && (
                        <div className="p-4 bg-[#FFDF00] brutal-border border-l-0 border-r-0 border-b-0">
                            <Overline className="mb-2">
                                merge recommendation (paste into AI agent)
                            </Overline>
                            <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                                {d.merge_recommendation}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {d?._parse_error && (
                <div className="p-4 font-mono text-xs">
                    <Overline className="mb-2">raw response</Overline>
                    <pre className="brutal-border p-3 bg-[#F0F0F0] whitespace-pre-wrap max-h-80 overflow-auto">
                        {d.raw}
                    </pre>
                </div>
            )}
        </BrutalCard>
    );
}
