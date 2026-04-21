import React, { useState, useRef } from "react";
import { toast } from "sonner";
import { FileCode, UploadSimple, X } from "@phosphor-icons/react";
import {
    BrutalCard,
    BrutalButton,
    BrutalLoader,
    Overline,
    Tag,
} from "../ui-brutal";
import { extractReact, fileToText } from "@/lib/api";

export default function ReactTab({ onExtracted }) {
    const [files, setFiles] = useState([]); // {name, content}
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    const handleFiles = async (fileList) => {
        const accepted = ["js", "jsx", "tsx", "ts"];
        const incoming = Array.from(fileList).filter((f) => {
            const ext = f.name.split(".").pop().toLowerCase();
            return accepted.includes(ext);
        });
        if (incoming.length === 0) {
            toast.error("No valid .js/.jsx/.tsx files");
            return;
        }
        const parsed = await Promise.all(
            incoming.map(async (f) => ({
                name: f.name,
                content: await fileToText(f),
            })),
        );
        setFiles((prev) => [...prev, ...parsed]);
    };

    const removeFile = (idx) =>
        setFiles((prev) => prev.filter((_, i) => i !== idx));

    const run = async () => {
        if (files.length === 0) {
            toast.error("Add at least one file");
            return;
        }
        setLoading(true);
        try {
            const res = await extractReact(files);
            toast.success(`Parsed ${files.length} file(s)`);
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
        <BrutalCard className="p-6" data-testid="react-tab">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <Overline>input / react source</Overline>
                    <h3
                        className="font-display font-black text-2xl leading-none mt-1"
                        style={{ letterSpacing: "-0.03em" }}
                    >
                        DROP .JS / .JSX / .TSX
                    </h3>
                </div>
                <Tag tone="primary">A</Tag>
            </div>

            <label
                htmlFor="react-file-input"
                className="block brutal-border border-dashed p-10 text-center cursor-pointer hover:bg-[#F0F0F0] transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    handleFiles(e.dataTransfer.files);
                }}
                data-testid="react-dropzone"
            >
                <input
                    ref={inputRef}
                    id="react-file-input"
                    type="file"
                    accept=".js,.jsx,.tsx,.ts"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                    data-testid="react-file-input"
                />
                <UploadSimple size={32} className="mx-auto mb-3" />
                <div className="font-mono text-sm uppercase tracking-wider">
                    drag files or click to select
                </div>
                <div className="font-mono text-xs text-[#555] mt-1">
                    supports multi-file / your entire /src folder
                </div>
            </label>

            {files.length > 0 && (
                <div className="mt-4 brutal-border">
                    <div className="bg-black text-white px-3 py-2 flex items-center justify-between">
                        <span className="overline">
                            queued // {files.length}
                        </span>
                        <button
                            onClick={() => setFiles([])}
                            className="text-xs uppercase underline"
                            data-testid="clear-files-btn"
                        >
                            clear
                        </button>
                    </div>
                    <div className="max-h-40 overflow-auto">
                        {files.map((f, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between px-3 py-2 brutal-border border-l-0 border-r-0 border-t-0 last:border-b-0"
                            >
                                <div className="flex items-center gap-2 font-mono text-xs truncate">
                                    <FileCode size={14} />
                                    <span className="truncate">{f.name}</span>
                                    <span className="text-[#999]">
                                        · {f.content.length}b
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeFile(idx)}
                                    className="hover:text-[#FF3B30]"
                                    data-testid={`remove-file-${idx}`}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-5 flex items-center gap-3">
                <BrutalButton
                    variant="primary"
                    onClick={run}
                    disabled={loading || files.length === 0}
                    data-testid="extract-react-btn"
                >
                    {loading ? (
                        <BrutalLoader label="parsing" />
                    ) : (
                        "Run extraction →"
                    )}
                </BrutalButton>
                <div className="font-mono text-[11px] text-[#555]">
                    pulls: imports · components · hooks · props · tailwind ·
                    colors · jsx tags
                </div>
            </div>
        </BrutalCard>
    );
}
