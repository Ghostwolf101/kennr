import React, { useState } from "react";
import { toast } from "sonner";
import {
    Download,
    Copy,
    CaretDown,
    CaretRight,
    Trash,
    Dna,
    FileCode,
    Browser,
    Image as ImageIcon,
    Globe,
} from "@phosphor-icons/react";
import { BrutalCard, BrutalButton, Overline, Tag } from "./ui-brutal";

const KIND_META = {
    react: {
        label: "REACT SOURCE",
        icon: <FileCode size={14} />,
        tone: "primary",
    },
    html: { label: "HTML", icon: <Browser size={14} />, tone: "accent" },
    url: { label: "URL", icon: <Globe size={14} />, tone: "secondary" },
    screenshot: {
        label: "SCREENSHOT",
        icon: <ImageIcon size={14} />,
        tone: "black",
    },
    dna: { label: "DESIGN DNA", icon: <Dna size={14} />, tone: "primary" },
};

const copy = (obj) => {
    const text =
        typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
};

const download = (filename, content) => {
    const blob = new Blob(
        [typeof content === "string" ? content : JSON.stringify(content, null, 2)],
        { type: "application/json" },
    );
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(u);
};

const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);

function ColorGrid({ colors, title = "COLOR TOKENS" }) {
    const items = Array.isArray(colors)
        ? colors.map((c) => (typeof c === "string" ? [c, 1] : [c.hex, 1]))
        : Object.entries(colors || {});
    if (!items.length) return null;
    return (
        <div>
            <Overline className="mb-2">{title}</Overline>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-0 brutal-border">
                {items.slice(0, 24).map(([c, n], i) => (
                    <div
                        key={i}
                        className="brutal-border border-t-0 border-l-0 aspect-square flex flex-col justify-between p-1"
                        style={{
                            background: isHex(c) ? c : "#fff",
                            color: getContrast(c),
                        }}
                        title={`${c} · ${n}`}
                    >
                        <span className="text-[9px] font-mono">
                            {n > 1 ? `×${n}` : ""}
                        </span>
                        <span className="text-[9px] font-mono truncate">
                            {c}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function getContrast(hex) {
    if (!isHex(hex)) return "#0A0A0A";
    const h = hex.length === 4
        ? "#" + [...hex.slice(1)].map((c) => c + c).join("")
        : hex.slice(0, 7);
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#0A0A0A" : "#FFFFFF";
}

function KVGrid({ data, max = 20, className = "" }) {
    const entries = Array.isArray(data)
        ? data.map((x) => [x, ""])
        : Object.entries(data || {});
    if (!entries.length) return <div className="text-xs text-[#999]">—</div>;
    return (
        <div className={`brutal-border ${className}`}>
            {entries.slice(0, max).map(([k, v], i) => (
                <div
                    key={i}
                    className="flex items-center justify-between px-3 py-1.5 brutal-border border-l-0 border-r-0 border-t-0 last:border-b-0"
                >
                    <span className="font-mono text-xs truncate mr-2">{k}</span>
                    {v !== "" && (
                        <span className="font-mono text-[10px] bg-black text-white px-1.5">
                            {v}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

function ReactView({ data }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 brutal-border">
            <Stat label="files" value={data.file_count} />
            <Stat label="lines" value={data.total_lines} />
            <Stat
                label="components"
                value={data.components?.length || 0}
            />
            <Stat
                label="unique classes"
                value={Object.keys(data.top_tailwind_classes || {}).length}
            />
            <Section title="Components detected" span full>
                <div className="flex flex-wrap gap-1">
                    {(data.components || []).slice(0, 40).map((c, i) => (
                        <Tag key={i} tone="muted">
                            {c}
                        </Tag>
                    ))}
                </div>
            </Section>
            <Section title="Top JSX tags">
                <KVGrid data={data.top_jsx_tags} />
            </Section>
            <Section title="Top tailwind classes">
                <KVGrid data={data.top_tailwind_classes} />
            </Section>
            <Section title="Hooks used">
                <KVGrid data={data.top_hooks} />
            </Section>
            <Section title="Top imports">
                <KVGrid data={data.top_imports} />
            </Section>
            <Section title="Colors found" span full>
                <ColorGrid
                    colors={data.color_tokens}
                    title=""
                />
            </Section>
            <Section title="Tailwind buckets" span full>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 brutal-border">
                    {Object.entries(data.tailwind_buckets || {}).map(
                        ([bucket, classes]) => (
                            <div
                                key={bucket}
                                className="brutal-border border-t-0 border-l-0 p-3"
                            >
                                <Overline className="mb-1">{bucket}</Overline>
                                <div className="font-display text-lg font-bold">
                                    {Object.values(classes).reduce(
                                        (a, b) => a + b,
                                        0,
                                    )}
                                </div>
                                <div className="text-[10px] font-mono text-[#555]">
                                    {Object.keys(classes).length} unique
                                </div>
                            </div>
                        ),
                    )}
                </div>
            </Section>
        </div>
    );
}

function HtmlView({ data }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 brutal-border">
            <Stat label="title" value={data.title || "—"} wide />
            <Stat label="elements" value={data.total_elements} />
            <Stat label="unique classes" value={data.unique_class_count} />
            <Stat label="images" value={data.image_count} />
            <Stat label="links" value={data.links_count} />
            <Stat label="buttons" value={data.buttons_count} />
            <Stat label="forms" value={data.forms_count} />
            <Stat label="scripts" value={data.scripts_count} />
            <Section title="Semantic tags">
                <KVGrid data={data.semantic_tag_counts} />
            </Section>
            <Section title="Tag counts">
                <KVGrid data={data.tag_counts} />
            </Section>
            <Section title="Top classes">
                <KVGrid data={data.top_classes} />
            </Section>
            <Section title="ARIA / role">
                <KVGrid data={data.aria_usage} />
            </Section>
            <Section title="Font families">
                <KVGrid data={data.font_families} />
            </Section>
            <Section title="Stylesheets">
                <KVGrid
                    data={(data.stylesheets || []).reduce(
                        (a, s) => ({ ...a, [s]: "" }),
                        {},
                    )}
                />
            </Section>
            <Section title="Color tokens" span full>
                <ColorGrid colors={data.color_tokens} title="" />
            </Section>
            <Section title="Headings" span full>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-0 brutal-border">
                    {Object.entries(data.headings || {}).map(([h, arr]) =>
                        (arr || []).length > 0 ? (
                            <div
                                key={h}
                                className="brutal-border border-t-0 border-l-0 p-3"
                            >
                                <Overline className="mb-1">{h}</Overline>
                                <ul className="text-xs font-mono space-y-1">
                                    {arr.slice(0, 5).map((t, i) => (
                                        <li
                                            key={i}
                                            className="truncate"
                                        >
                                            › {t}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null,
                    )}
                </div>
            </Section>
        </div>
    );
}

function ScreenshotView({ data }) {
    if (data._parse_error) {
        return (
            <div className="p-4 brutal-border bg-[#F0F0F0] font-mono text-xs">
                Vision returned unstructured text:
                <pre className="mt-2 whitespace-pre-wrap">{data.raw}</pre>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 brutal-border">
            <Section title="Aesthetic" span full>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 brutal-border">
                    {Object.entries(data.aesthetic || {}).map(([k, v]) => (
                        <div
                            key={k}
                            className="brutal-border border-t-0 border-l-0 p-3"
                        >
                            <Overline className="mb-1">{k}</Overline>
                            <div className="font-mono text-xs">{v}</div>
                        </div>
                    ))}
                </div>
            </Section>
            <Section title="Color palette" span full>
                <ColorGrid
                    colors={(data.color_palette || []).map((c) => c.hex || c)}
                    title=""
                />
            </Section>
            <Section title="Typography">
                <KVGrid
                    data={Object.fromEntries(
                        Object.entries(data.typography || {}).map(([k, v]) => [
                            k,
                            Array.isArray(v) ? v.join(", ") : v,
                        ]),
                    )}
                />
            </Section>
            <Section title="Layout">
                <KVGrid data={data.layout} />
            </Section>
            <Section title="Standout elements">
                <List items={data.standout_elements} />
            </Section>
            <Section title="Cookie-cutter risks" tone="primary">
                <List items={data.cookie_cutter_risks} />
            </Section>
            <Section title="Anti-patterns to avoid" tone="primary" span full>
                <List items={data.anti_patterns_to_avoid} />
            </Section>
            <Section title="AI prompt brief" tone="accent" span full>
                <div className="p-3 font-mono text-xs leading-relaxed">
                    {data.ai_prompt_brief}
                </div>
            </Section>
        </div>
    );
}

function DnaView({ data }) {
    if (data._parse_error) {
        return (
            <div className="p-4 brutal-border bg-[#F0F0F0] font-mono text-xs">
                <div className="mb-2 uppercase tracking-wider">
                    DNA synthesis returned unstructured text
                </div>
                <pre className="whitespace-pre-wrap">{data.raw}</pre>
            </div>
        );
    }
    const fp = data.project_fingerprint || {};
    const tokens = data.design_tokens || {};
    const patterns = data.component_patterns || {};
    const avoid = data.ai_slop_avoidance || {};
    return (
        <div className="space-y-0 brutal-border">
            <div className="p-5 bg-black text-white">
                <Overline className="text-[#FFDF00] mb-2">
                    project fingerprint
                </Overline>
                <div
                    className="font-display font-black text-2xl md:text-3xl leading-tight"
                    style={{ letterSpacing: "-0.03em" }}
                >
                    {fp.one_liner}
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                        <Overline className="text-[#999]">philosophy</Overline>
                        <div className="font-mono text-xs mt-1">
                            {fp.design_philosophy}
                        </div>
                    </div>
                    <div>
                        <Overline className="text-[#999]">archetype</Overline>
                        <div className="font-mono text-xs mt-1">
                            {fp.archetype}
                        </div>
                    </div>
                    <div>
                        <Overline className="text-[#999]">signatures</Overline>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {(fp.signature_traits || []).map((t, i) => (
                                <span
                                    key={i}
                                    className="bg-[#FFDF00] text-black px-1.5 py-0.5 text-[10px] font-mono"
                                >
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 brutal-border border-l-0 border-r-0">
                <div className="p-4 brutal-border border-t-0 border-l-0 border-b-0">
                    <Overline className="mb-2">
                        primary · neutral · accent
                    </Overline>
                    <ColorGrid
                        colors={[
                            ...(tokens.primary_colors || []),
                            ...(tokens.neutral_colors || []),
                            ...(tokens.accent_colors || []),
                        ]}
                        title=""
                    />
                </div>
                <div className="p-4 brutal-border border-t-0 border-l-0 border-b-0">
                    <Overline className="mb-2">typography</Overline>
                    <KVGrid data={tokens.typography} />
                </div>
                <div className="p-4">
                    <Overline className="mb-2">language</Overline>
                    <KVGrid
                        data={{
                            spacing: tokens.spacing_rhythm,
                            radius: tokens.border_radius_language,
                            shadow: tokens.shadow_language,
                            motion: tokens.motion_language,
                        }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 brutal-border border-l-0 border-r-0 border-b-0">
                <div className="p-4 brutal-border border-t-0 border-l-0 border-b-0">
                    <Overline className="mb-2">component patterns</Overline>
                    <KVGrid data={patterns} />
                </div>
                <div className="p-4 bg-[#FFDF00]">
                    <Overline className="mb-2">AI-slop avoidance</Overline>
                    <div className="text-xs font-mono uppercase tracking-wider mb-1">
                        forbidden
                    </div>
                    <List items={avoid.forbidden_patterns} />
                    <div className="text-xs font-mono uppercase tracking-wider mt-3 mb-1">
                        required distinctives
                    </div>
                    <List items={avoid.required_distinctives} />
                </div>
            </div>

            {data.ready_to_use_ai_prompt && (
                <div className="p-5 bg-[#FF3B30] text-white brutal-border border-l-0 border-r-0 border-b-0">
                    <div className="flex items-center justify-between mb-2">
                        <Overline className="text-white">
                            ready-to-use ai prompt
                        </Overline>
                        <button
                            onClick={() => copy(data.ready_to_use_ai_prompt)}
                            className="text-xs uppercase underline font-mono"
                            data-testid="copy-ai-prompt-btn"
                        >
                            copy
                        </button>
                    </div>
                    <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                        {data.ready_to_use_ai_prompt}
                    </div>
                </div>
            )}

            {data.ready_to_use_markdown_brief && (
                <div className="p-5 bg-white brutal-border border-l-0 border-r-0 border-b-0">
                    <div className="flex items-center justify-between mb-2">
                        <Overline>markdown brief</Overline>
                        <button
                            onClick={() =>
                                copy(data.ready_to_use_markdown_brief)
                            }
                            className="text-xs uppercase underline font-mono"
                            data-testid="copy-markdown-btn"
                        >
                            copy
                        </button>
                    </div>
                    <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-80 overflow-auto brutal-border p-3 bg-[#F0F0F0]">
                        {data.ready_to_use_markdown_brief}
                    </pre>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, wide = false }) {
    return (
        <div
            className={`p-4 brutal-border border-t-0 border-l-0 ${
                wide ? "md:col-span-2" : ""
            }`}
        >
            <Overline>{label}</Overline>
            <div
                className="font-display font-black text-2xl mt-1 leading-none truncate"
                style={{ letterSpacing: "-0.03em" }}
            >
                {value ?? "—"}
            </div>
        </div>
    );
}

function Section({ title, children, span = "half", tone }) {
    const full = span === "full";
    const bg = tone === "primary" ? "bg-[#F0F0F0]" : tone === "accent" ? "bg-[#FFDF00]" : "";
    return (
        <div
            className={`p-4 brutal-border border-t-0 border-l-0 ${bg} ${
                full ? "md:col-span-2" : ""
            }`}
        >
            <Overline className="mb-2">{title}</Overline>
            {children}
        </div>
    );
}

function List({ items }) {
    if (!items || items.length === 0)
        return <div className="text-xs text-[#999]">—</div>;
    return (
        <ul className="space-y-1">
            {items.map((t, i) => (
                <li key={i} className="font-mono text-xs flex gap-2">
                    <span className="text-[#FF3B30] shrink-0">›</span>
                    <span>{t}</span>
                </li>
            ))}
        </ul>
    );
}

export default function ExtractionCard({
    record,
    index,
    onRemove,
    defaultOpen = true,
}) {
    const [open, setOpen] = useState(defaultOpen);
    const meta = KIND_META[record.kind] || KIND_META.html;

    const renderBody = () => {
        switch (record.kind) {
            case "react":
                return <ReactView data={record.data} />;
            case "html":
            case "url":
                return <HtmlView data={record.data} />;
            case "screenshot":
                return <ScreenshotView data={record.data} />;
            case "dna":
                return <DnaView data={record.data} />;
            default:
                return (
                    <pre className="p-3 text-[10px] overflow-auto bg-[#F0F0F0]">
                        {JSON.stringify(record.data, null, 2)}
                    </pre>
                );
        }
    };

    return (
        <BrutalCard
            className="overflow-hidden"
            data-testid={`extraction-card-${index}`}
        >
            <div className="flex items-center justify-between px-4 py-3 bg-white brutal-border border-l-0 border-r-0 border-t-0">
                <button
                    onClick={() => setOpen(!open)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                    data-testid={`toggle-extraction-${index}`}
                >
                    {open ? (
                        <CaretDown size={14} />
                    ) : (
                        <CaretRight size={14} />
                    )}
                    <span className="shrink-0">
                        <Tag tone={meta.tone}>
                            {meta.icon} {meta.label}
                        </Tag>
                    </span>
                    <span className="font-mono text-xs truncate text-[#555]">
                        {record.label || record.id.slice(0, 8)}
                    </span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        className="px-2 py-1 brutal-border text-[10px] uppercase font-mono hover:bg-black hover:text-white"
                        onClick={() => copy(record.data)}
                        data-testid={`copy-extraction-${index}`}
                        title="Copy JSON"
                    >
                        <Copy size={12} />
                    </button>
                    <button
                        className="px-2 py-1 brutal-border text-[10px] uppercase font-mono hover:bg-black hover:text-white"
                        onClick={() =>
                            download(
                                `${record.kind}-${record.id.slice(0, 6)}.json`,
                                record.data,
                            )
                        }
                        data-testid={`download-extraction-${index}`}
                        title="Download JSON"
                    >
                        <Download size={12} />
                    </button>
                    {onRemove && (
                        <button
                            className="px-2 py-1 brutal-border text-[10px] uppercase font-mono hover:bg-[#FF3B30] hover:text-white"
                            onClick={onRemove}
                            data-testid={`remove-extraction-${index}`}
                            title="Remove"
                        >
                            <Trash size={12} />
                        </button>
                    )}
                </div>
            </div>
            {open && <div className="p-0">{renderBody()}</div>}
        </BrutalCard>
    );
}
