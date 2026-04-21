import React, { useState } from "react";
import { toast } from "sonner";
import { Globe } from "@phosphor-icons/react";
import {
    BrutalCard,
    BrutalButton,
    BrutalInput,
    BrutalLoader,
    Overline,
    Tag,
} from "../ui-brutal";
import { extractUrl } from "@/lib/api";

export default function UrlTab({ onExtracted }) {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);

    const run = async () => {
        if (!url.trim()) {
            toast.error("Enter a URL");
            return;
        }
        let target = url.trim();
        if (!/^https?:\/\//i.test(target)) target = "https://" + target;

        setLoading(true);
        try {
            const res = await extractUrl(target);
            toast.success("URL fetched & parsed");
            onExtracted(res);
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "Fetch failed",
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

            <div className="mt-3 font-mono text-[11px] text-[#555]">
                note: server-side fetch (no JS execution). for JS-rendered sites,
                use the HTML tab with copied outerHTML.
            </div>

            <div className="mt-5 flex items-center gap-3">
                <BrutalButton
                    variant="primary"
                    onClick={run}
                    disabled={loading || !url.trim()}
                    data-testid="extract-url-btn"
                >
                    {loading ? (
                        <BrutalLoader label="fetching" />
                    ) : (
                        "Fetch & extract →"
                    )}
                </BrutalButton>
            </div>
        </BrutalCard>
    );
}
