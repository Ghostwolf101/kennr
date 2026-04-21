import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
    FileCode,
    Browser,
    Image as ImageIcon,
    Globe,
    Dna,
    Download,
    Copy,
    GitDiff,
} from "@phosphor-icons/react";
import Header from "@/components/Header";
import ReactTab from "@/components/tabs/ReactTab";
import HtmlTab from "@/components/tabs/HtmlTab";
import UrlTab from "@/components/tabs/UrlTab";
import ScreenshotTab from "@/components/tabs/ScreenshotTab";
import ExtractionCard from "@/components/ExtractionCard";
import ProjectsBar from "@/components/ProjectsBar";
import DnaDiff from "@/components/DnaDiff";
import TokenExport from "@/components/TokenExport";
import {
    BrutalCard,
    BrutalButton,
    BrutalLoader,
    Overline,
    Tag,
} from "@/components/ui-brutal";
import { analyzeDna, updateProject, getProject } from "@/lib/api";

const TABS = [
    { id: "react", label: "React", icon: FileCode, accent: "#FF3B30" },
    { id: "html", label: "HTML", icon: Browser, accent: "#FFDF00" },
    { id: "screenshot", label: "Shot", icon: ImageIcon, accent: "#0A0A0A" },
    { id: "url", label: "URL", icon: Globe, accent: "#002FA7" },
];

export default function Extractor() {
    const [active, setActive] = useState("react");
    const [extractions, setExtractions] = useState([]);
    const [dna, setDna] = useState(null);
    const [dnaLoading, setDnaLoading] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [projectsVersion, setProjectsVersion] = useState(0);
    const [showDiff, setShowDiff] = useState(false);
    const [tokenExportFor, setTokenExportFor] = useState(null);

    // When a project is selected, load its extractions
    useEffect(() => {
        if (!activeProjectId) return;
        (async () => {
            try {
                const proj = await getProject(activeProjectId);
                setProjectName(proj.name);
                setExtractions(
                    (proj.extractions || []).map((e) => ({
                        id: e.id,
                        kind: e.kind,
                        label: e.label || e.id.slice(0, 8),
                        data: e.data,
                    })),
                );
                setDna(
                    proj.dna
                        ? {
                              id: proj.dna.id,
                              kind: "dna",
                              label: proj.dna.label || proj.name,
                              data: proj.dna.data,
                          }
                        : null,
                );
            } catch (e) {
                toast.error("Failed to load project");
            }
        })();
    }, [activeProjectId]);

    const add = async (res) => {
        const rec = {
            id: res.id,
            kind: res.kind,
            label: deriveLabel(res),
            data: res.data,
        };
        setExtractions((prev) => [rec, ...prev]);
        if (activeProjectId) {
            try {
                await updateProject(activeProjectId, {
                    add_extraction_ids: [res.id],
                });
                setProjectsVersion((v) => v + 1);
            } catch (e) {
                // non-fatal
            }
        }
    };

    const deriveLabel = (res) => {
        if (res.kind === "react")
            return `${res.data.file_count} file(s) · ${res.data.total_lines} lines`;
        if (res.kind === "html" || res.kind === "url")
            return res.data.title || res.data.source_url || "html";
        if (res.kind === "screenshot")
            return (
                res.source_url ||
                res.data?.aesthetic?.mood ||
                "vision analysis"
            );
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
            const dnaRec = {
                id: res.id,
                kind: "dna",
                label: projectName || "Design DNA",
                data: res.data,
            };
            setDna(dnaRec);
            if (activeProjectId) {
                try {
                    await updateProject(activeProjectId, {
                        dna_id: res.id,
                    });
                    setProjectsVersion((v) => v + 1);
                } catch (e) {
                    // non-fatal
                }
            }
            toast.success("Design DNA synthesized");
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "DNA synthesis failed",
            );
        } finally {
            setDnaLoading(false);
        }
    };

    const removeExtraction = async (id) => {
        setExtractions((prev) => prev.filter((x) => x.id !== id));
        if (activeProjectId) {
            try {
                await updateProject(activeProjectId, {
                    remove_extraction_ids: [id],
                });
                setProjectsVersion((v) => v + 1);
            } catch (e) {
                // non-fatal
            }
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

    const selectProject = (id) => {
        if (id === null) {
            setActiveProjectId(null);
            setExtractions([]);
            setDna(null);
            setProjectName("");
            return;
        }
        setActiveProjectId(id);
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
                            and build something that{" "}
                            <em>doesn&apos;t look AI-generated</em>.
                        </p>
                    </div>
                    <div className="md:col-span-4">
                        <BrutalCard className="p-4">
                            <Overline className="mb-2">
                                {activeProjectId ? "project" : "project name"}
                            </Overline>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="my-next-big-thing"
                                className="w-full brutal-border px-3 py-2 font-mono text-sm focus:outline-none focus:border-[#FF3B30]"
                                data-testid="project-name-input"
                            />
                            <div className="mt-3 grid grid-cols-3 gap-0 brutal-border">
                                <div className="brutal-border border-t-0 border-l-0 p-2">
                                    <Overline>inputs</Overline>
                                    <div className="font-display font-black text-xl">
                                        {extractions.length}
                                    </div>
                                </div>
                                <div className="brutal-border border-t-0 border-l-0 p-2">
                                    <Overline>dna</Overline>
                                    <div className="font-display font-black text-xl">
                                        {dna ? "✓" : "—"}
                                    </div>
                                </div>
                                <div className="p-2">
                                    <Overline>project</Overline>
                                    <div className="font-display font-black text-xl truncate">
                                        {activeProjectId ? "●" : "—"}
                                    </div>
                                </div>
                            </div>
                        </BrutalCard>
                    </div>
                </div>
            </section>

            {/* MAIN GRID */}
            <section className="grid grid-cols-1 lg:grid-cols-12">
                {/* LEFT: INPUTS + PROJECTS */}
                <div className="lg:col-span-5 xl:col-span-4 brutal-border border-t-0 border-l-0 border-b-0 p-4 md:p-6 space-y-6">
                    <div>
                        <Overline className="mb-3">00 · projects</Overline>
                        <ProjectsBar
                            key={projectsVersion}
                            activeProjectId={activeProjectId}
                            onSelect={selectProject}
                            onProjectChanged={() =>
                                setProjectsVersion((v) => v + 1)
                            }
                            onDnaSynthesized={(res) => {
                                const dnaRec = {
                                    id: res.id,
                                    kind: "dna",
                                    label:
                                        extractions[0]?.label ||
                                        "Project DNA",
                                    data: res.data,
                                };
                                setDna(dnaRec);
                            }}
                            extractionCount={extractions.length}
                        />
                    </div>

                    <div>
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
                                                ? {
                                                      borderBottomColor:
                                                          t.accent,
                                                      borderBottomWidth: 4,
                                                  }
                                                : undefined
                                        }
                                        data-testid={`tab-${t.id}`}
                                    >
                                        <Icon size={18} />
                                        <span>{t.label}</span>
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
                    </div>

                    <div>
                        <Overline className="mb-2">02 · synthesis</Overline>
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
                                one comprehensive AI-ready brief.
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

                    <div>
                        <Overline className="mb-2">03 · compare</Overline>
                        <BrutalCard className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <GitDiff size={18} />
                                <h3
                                    className="font-display font-black text-lg"
                                    style={{ letterSpacing: "-0.02em" }}
                                >
                                    DIFF TWO DNAs
                                </h3>
                            </div>
                            <BrutalButton
                                variant="secondary"
                                onClick={() => setShowDiff((s) => !s)}
                                className="w-full"
                                data-testid="open-diff-btn"
                            >
                                <GitDiff size={14} />
                                {showDiff ? "Hide diff panel" : "Open diff panel"}
                            </BrutalButton>
                        </BrutalCard>
                    </div>

                    <div>
                        <Overline className="mb-2">04 · export</Overline>
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
                <div className="lg:col-span-7 xl:col-span-8 p-4 md:p-6 bg-[#FAFAFA] space-y-4">
                    {showDiff && <DnaDiff onClose={() => setShowDiff(false)} />}

                    {tokenExportFor && (
                        <TokenExport
                            extractionId={tokenExportFor.id}
                            label={tokenExportFor.label}
                            onClose={() => setTokenExportFor(null)}
                        />
                    )}

                    <div className="flex items-center justify-between">
                        <Overline>05 · extracted data</Overline>
                        <Tag tone="black">
                            {extractions.length + (dna ? 1 : 0)} total
                        </Tag>
                    </div>

                    {dna && (
                        <ExtractionCard
                            record={dna}
                            index="dna"
                            onRemove={() => setDna(null)}
                            onExportTokens={setTokenExportFor}
                        />
                    )}

                    {extractions.length === 0 && !dna && !showDiff ? (
                        <EmptyState />
                    ) : (
                        extractions.map((e, i) => (
                            <ExtractionCard
                                key={e.id}
                                record={e}
                                index={i}
                                defaultOpen={i === 0}
                                onRemove={() => removeExtraction(e.id)}
                                onExportTokens={setTokenExportFor}
                            />
                        ))
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
            <div className="mx-auto mb-4 w-20 h-20 brutal-border grid-lines grid-shift" />
            <h3
                className="font-display font-black text-2xl md:text-3xl leading-tight"
                style={{ letterSpacing: "-0.03em" }}
            >
                NO EXTRACTIONS YET
            </h3>
            <p className="mt-2 font-mono text-xs text-[#555] max-w-md mx-auto leading-relaxed">
                Pick an input on the left. Screenshots unlock vision analysis;
                source files unlock structural diffs. Group extractions into a
                project to compare DNAs later.
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
