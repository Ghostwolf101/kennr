import React, { useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, UploadSimple, X } from "@phosphor-icons/react";
import {
    BrutalCard,
    BrutalButton,
    BrutalInput,
    BrutalLoader,
    Overline,
    Tag,
} from "../ui-brutal";
import { extractScreenshot, fileToBase64 } from "@/lib/api";

export default function ScreenshotTab({ onExtracted }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [label, setLabel] = useState("");
    const [loading, setLoading] = useState(false);

    const pickFile = (f) => {
        if (!f) return;
        const type = f.type || "";
        if (!/png|jpeg|jpg|webp/i.test(type)) {
            toast.error("PNG / JPG / WEBP only");
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const run = async () => {
        if (!file) {
            toast.error("Select an image");
            return;
        }
        setLoading(true);
        try {
            const b64 = await fileToBase64(file);
            const res = await extractScreenshot(
                b64,
                file.type,
                label || file.name,
            );
            toast.success("Vision analysis complete");
            onExtracted(res);
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "Vision analysis failed",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <BrutalCard className="p-6" data-testid="screenshot-tab">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <Overline>input / screenshot</Overline>
                    <h3
                        className="font-display font-black text-2xl leading-none mt-1"
                        style={{ letterSpacing: "-0.03em" }}
                    >
                        UPLOAD PNG / JPG
                    </h3>
                </div>
                <Tag tone="black">C</Tag>
            </div>

            <Overline className="mb-1">label (optional)</Overline>
            <BrutalInput
                placeholder="hero section / full page / dashboard"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                data-testid="screenshot-label-input"
            />

            <label
                htmlFor="shot-input"
                className="mt-4 block brutal-border border-dashed p-6 text-center cursor-pointer hover:bg-[#F0F0F0]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files?.[0]);
                }}
                data-testid="screenshot-dropzone"
            >
                {preview ? (
                    <div className="relative">
                        <img
                            src={preview}
                            alt="preview"
                            className="mx-auto max-h-64 brutal-border"
                        />
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                setFile(null);
                                setPreview(null);
                            }}
                            className="absolute top-2 right-2 bg-black text-white brutal-border p-1"
                            data-testid="clear-screenshot-btn"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <>
                        <UploadSimple size={32} className="mx-auto mb-3" />
                        <div className="font-mono text-sm uppercase tracking-wider">
                            drop image or click to select
                        </div>
                        <div className="font-mono text-xs text-[#555] mt-1">
                            png / jpg / webp · resized server-side
                        </div>
                    </>
                )}
                <input
                    id="shot-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                    data-testid="screenshot-file-input"
                />
            </label>

            <div className="mt-5 flex items-center gap-3">
                <BrutalButton
                    variant="primary"
                    onClick={run}
                    disabled={loading || !file}
                    data-testid="extract-screenshot-btn"
                >
                    {loading ? (
                        <BrutalLoader label="analyzing" />
                    ) : (
                        "Run vision analysis →"
                    )}
                </BrutalButton>
                <div className="font-mono text-[11px] text-[#555]">
                    <ImageIcon size={12} className="inline mr-1" />
                    claude sonnet 4.5 vision → aesthetic dna
                </div>
            </div>
        </BrutalCard>
    );
}
