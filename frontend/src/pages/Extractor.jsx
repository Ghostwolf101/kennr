import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
    FileCode,
    Browser,
    Image as ImageIcon,
    Globe,
    Dna,
    Download,
    Copy,
} from "@phosphor-icons/react";
import Header from "@/components/Header";
import ReactTab from "@/components/tabs/ReactTab";
import HtmlTab from "@/components/tabs/HtmlTab";
import UrlTab from "@/components/tabs/UrlTab";
import ScreenshotTab from "@/components/tabs/ScreenshotTab";
import ExtractionCard from "@/components/ExtractionCard";
import {
    BrutalCard,
    BrutalButton,
    BrutalLoader,
    Overline,
    Tag,
} from "@/components/ui-brutal";
import { analyzeDna } from "@/lib/api";

const TABS = [
    { id: "react", label: "React Source", icon: FileCode, accent: "#FF3B30" },
    { id: "html", label: "Rendered HTML", icon: Browser, accent: "#FFDF00" },
    { id: "screenshot", label: "Screenshot", icon: ImageIcon, accent: "#0A0A0A" },
    { id: "url", label: "Live URL", icon: Globe, accent: "#002FA7" },
];

export default function Extractor() {
    const [active, setActive] = useState("react");
    const [extractions, setExtractions] = useState([]); // {id, kind, label, data}
    const [dna, setDna] = useState(null);
    const [dnaLoading, setDnaLoading] = useState(false);
    const [projectName, setProjectName] = useState("");

    const add = (res) => {
        setExtractions((prev) => [
            {
                id: res.id,
                kind: res.kind,
                label: deriveLabel(res),
                data: res.data,
            },
            ...prev,
        ]);
    };

    const deriveLabel = (res) => {
        if (res.kind === "react")
            return `${res.data.file_count} file(s) · ${res.data.total_lines} lines`;
        if (res.kind === "html" || res.kind === "url")
            return res.data.title || res.data.source_url || "html";
        if (res.kind === "screenshot")
            return res.data.aesthetic?.mood || "vision analysis";
        return res.id.slice(0, 8);
    };

    const nonDna = useMemo(
        () => extractions.filter((e) => e.kind !== "dna"),
        [extractions],
    );

    const runDna = async () => {
        if (nonDna.length === 0) {
            toast.error("Add at least one extraction first");
            return;
        }
        setDnaLoading(true);
        try {
            const res = await analyzeDna(
                nonDna.map((e) => e.id),
                projectName || "Untitled Project",
            );
            setDna({
                id: res.id,
                kind: "dna",
                label: projectName || "Design DNA",
                data: res.data,
            });
            toast.success("Design DNA synthesized");
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "DNA synthesis failed",
            );
        } finally {
            setDnaLoading(false);
        }
    };

    const exportAll = () => {
        const payload = {
            project_name: projectName || "Untitled Project",
            generated_at: new Date().toISOString(),
            dna: dna?.data || null,
            extractions: extractions.map((e) => ({
                id: e.id,
                kind: e.kind,
                label: e.label,
                data: e.data,
            })),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
        });
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = `${(projectName || "extractor").replace(/\s+/g, "-")}-bundle.json`;
        a.click();
        URL.revokeObjectURL(u);
        toast.success("Bundle downloaded");
    };

    const copyBundle = () => {
        const payload = {
            project_name: projectName || "Untitled Project",
            generated_at: new Date().toISOString(),
            dna: dna?.data || null,
            extractions,
        };
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        toast.success("Bundle copied");
    };

    return (
        <div
            className="min-h-screen bg-white"
            data-testid="extractor-page"
        >
            <Header extractionCount={extractions.length + (dna ? 1 : 0)} />

            {/* HERO */}
            <section className="px-4 md:px-8 py-8 md:py-12 brutal-border border-t-0 border-l-0 border-r-0 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-8">
                        <Overline className="mb-2">
                            // emergent preview → ai-readable dna
                        </Overline>
                        <h1
                            className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-[0.85] tracking-tight"
                            style={{ letterSpacing: "-0.05em" }}
                            data-testid="hero-heading"
                        >
                            EXTRACT.
                            <br />
                            <span className="text-[#FF3B30]">REMIX.</span>
                            <br />
                            ESCAPE SLOP.
                        </h1>
                        <p className="mt-5 font-mono text-sm md:text-base max-w-2xl leading-relaxed text-[#333]">
                            Feed it React source, rendered HTML, URLs or
                            screenshots. Get structured design DNA any AI
                            coding agent can paste directly into its prompt —
                            and build something that <em>doesn&apos;t look AI-generated</em>.
                        </p>
                    </div>
                    <div className="md:col-span-4">
                        <BrutalCard className="p-4">
                            <Overline className="mb-2">project name</Overline>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="my-next-big-thing"
                                className="w-full brutal-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#FF3B30]"
                                data-testid="project-name-input"
                            />
                            <div className="mt-3 grid grid-cols-2 gap-0 brutal-border">
                                <div className="brutal-border border-t-0 border-l-0 p-2">
                                    <Overline>inputs</Overline>
                                    <div className="font-display font-black text-xl">
                                        {extractions.length}
                                    </div>
                                </div>
                                <div className="p-2">
                                    <Overline>dna</Overline>
                                    <div className="font-display font-black text-xl">
                                        {dna ? "READY" : "—"}
                                    </div>
                                </div>
                            </div>
                        </BrutalCard>
                    </div>
                </div>
            </section>

            {/* MAIN GRID */}
            <section className="grid grid-cols-1 lg:grid-cols-12">
                {/* LEFT: INPUTS */}
                <div className="lg:col-span-5 xl:col-span-4 brutal-border border-t-0 border-l-0 border-b-0 p-4 md:p-6">
                    <Overline className="mb-3">01 · inputs</Overline>

                    <div className="brutal-border mb-4 grid grid-cols-4">
                        {TABS.map((t) => {
                            const Icon = t.icon;
                            const isActive = active === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setActive(t.id)}
                                    className={`p-3 brutal-border border-t-0 border-l-0 last:border-r-0 font-mono text-[10px] uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                                        isActive
                                            ? "bg-black text-white"
                                            : "bg-white hover:bg-[#F0F0F0]"
                                    }`}
                                    style={
                                        isActive
                                            ? { borderBottomColor: t.accent, borderBottomWidth: 4 }
                                            : undefined
                                    }
                                    data-testid={`tab-${t.id}`}
                                >
                                    <Icon size={18} />
                                    <span className="hidden sm:inline">
                                        {t.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div>
                        {active === "react" && <ReactTab onExtracted={add} />}
                        {active === "html" && <HtmlTab onExtracted={add} />}
                        {active === "screenshot" && (
                            <ScreenshotTab onExtracted={add} />
                        )}
                        {active === "url" && <UrlTab onExtracted={add} />}
                    </div>

                    <div className="mt-6">
                        <Overline className="mb-2">
                            02 · synthesis
                        </Overline>
                        <BrutalCard className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Dna size={18} />
                                <h3
                                    className="font-display font-black text-lg"
                                    style={{ letterSpacing: "-0.02em" }}
                                >
                                    SYNTHESIZE DESIGN DNA
                                </h3>
                            </div>
                            <p className="font-mono text-[11px] text-[#555] leading-relaxed mb-3">
                                Combines all {nonDna.length} extraction(s) into
                                one comprehensive AI-ready brief with ready-to-paste
                                prompt &amp; markdown.
                            </p>
                            <BrutalButton
                                variant="accent"
                                onClick={runDna}
                                disabled={dnaLoading || nonDna.length === 0}
                                className="w-full"
                                data-testid="synthesize-dna-btn"
                            >
                                {dnaLoading ? (
                                    <BrutalLoader label="synthesizing" />
                                ) : (
                                    <>
                                        <Dna size={16} /> Run DNA synthesis
                                    </>
                                )}
                            </BrutalButton>
                        </BrutalCard>
                    </div>

                    <div className="mt-6">
                        <Overline className="mb-2">03 · export</Overline>
                        <div className="grid grid-cols-2 gap-0 brutal-border">
                            <button
                                onClick={exportAll}
                                disabled={extractions.length === 0}
                                className="p-3 brutal-border border-t-0 border-l-0 border-b-0 font-mono text-xs uppercase flex items-center justify-center gap-2 hover:bg-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                data-testid="download-bundle-btn"
                            >
                                <Download size={14} /> JSON
                            </button>
                            <button
                                onClick={copyBundle}
                                disabled={extractions.length === 0}
                                className="p-3 brutal-border border-t-0 border-b-0 font-mono text-xs uppercase flex items-center justify-center gap-2 hover:bg-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                data-testid="copy-bundle-btn"
                            >
                                <Copy size={14} /> COPY
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: RESULTS */}
                <div className="lg:col-span-7 xl:col-span-8 p-4 md:p-6 bg-[#FAFAFA]">
                    <div className="flex items-center justify-between mb-3">
                        <Overline>04 · extracted data</Overline>
                        <Tag tone="black">
                            {extractions.length + (dna ? 1 : 0)} total
                        </Tag>
                    </div>

                    {dna && (
                        <div className="mb-4">
                            <ExtractionCard
                                record={dna}
                                index="dna"
                                onRemove={() => setDna(null)}
                            />
                        </div>
                    )}

                    {extractions.length === 0 && !dna ? (
                        <EmptyState />
                    ) : (
                        <div className="space-y-4">
                            {extractions.map((e, i) => (
                                <ExtractionCard
                                    key={e.id}
                                    record={e}
                                    index={i}
                                    defaultOpen={i === 0}
                                    onRemove={() =>
                                        setExtractions((prev) =>
                                            prev.filter((x) => x.id !== e.id),
                                        )
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* FOOTER */}
            <footer className="brutal-border border-l-0 border-r-0 border-b-0 p-4 md:p-6 bg-black text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-mono text-[11px] uppercase tracking-wider">
                        emergent-extractor // built to steal aesthetics, not
                        designs
                    </div>
                    <div className="flex gap-2">
                        <Tag tone="primary">REACT</Tag>
                        <Tag tone="accent">HTML</Tag>
                        <Tag tone="muted">SCREENSHOT</Tag>
                        <Tag tone="secondary">URL</Tag>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function EmptyState() {
    return (
        <BrutalCard
            className="p-8 text-center"
            data-testid="empty-state"
        >
            <div
                className="mx-auto mb-4 w-20 h-20 brutal-border grid-lines grid-shift"
            />
            <h3
                className="font-display font-black text-2xl md:text-3xl leading-tight"
                style={{ letterSpacing: "-0.03em" }}
            >
                NO EXTRACTIONS YET
            </h3>
            <p className="mt-2 font-mono text-xs text-[#555] max-w-md mx-auto leading-relaxed">
                Pick an input on the left. The more you feed it, the better the
                design DNA synthesis gets. Screenshots unlock vision analysis;
                source files unlock structural diffs.
            </p>
            <div className="mt-5 flex justify-center flex-wrap gap-2">
                <Tag tone="primary">A · REACT</Tag>
                <Tag tone="accent">B · HTML</Tag>
                <Tag tone="black">C · SCREENSHOT</Tag>
                <Tag tone="secondary">D · URL</Tag>
            </div>
        </BrutalCard>
    );
}
