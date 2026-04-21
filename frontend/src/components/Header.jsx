import React from "react";
import { Lightning, Barcode } from "@phosphor-icons/react";
import { Tag } from "./ui-brutal";

export default function Header({ extractionCount = 0 }) {
    const now = new Date();
    const ts = now.toISOString().slice(0, 19).replace("T", " ");

    return (
        <header
            className="brutal-border border-t-0 border-l-0 border-r-0 bg-white"
            data-testid="app-header"
        >
            <div className="flex flex-wrap items-stretch">
                <div className="flex items-center gap-3 px-6 py-4 brutal-border border-t-0 border-l-0 border-b-0">
                    <div className="w-10 h-10 bg-black flex items-center justify-center">
                        <Lightning
                            size={22}
                            weight="fill"
                            color="#FFDF00"
                        />
                    </div>
                    <div>
                        <div className="overline text-[#555]">
                            emergent // v0.1
                        </div>
                        <div
                            className="font-display font-black text-xl tracking-tight leading-none"
                            style={{ letterSpacing: "-0.04em" }}
                        >
                            EXTRACTOR
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex items-center px-6 py-4 brutal-border border-t-0 border-l-0 border-b-0 flex-1 min-w-0">
                    <div className="overline text-[#555] mr-4">
                        mission //
                    </div>
                    <div className="font-mono text-xs truncate">
                        Extract design DNA from React source, HTML, URLs &amp;
                        screenshots. Export AI-ready briefs. Step away from
                        cookie-cutter.
                    </div>
                </div>

                <div className="flex items-center gap-3 px-6 py-4 brutal-border border-t-0 border-l-0 border-b-0">
                    <Tag tone="muted">session</Tag>
                    <span className="font-mono text-xs">{ts} UTC</span>
                </div>

                <div
                    className="flex items-center gap-2 px-6 py-4"
                    data-testid="extraction-counter"
                >
                    <Barcode size={16} />
                    <span className="font-mono text-xs uppercase tracking-wider">
                        {extractionCount.toString().padStart(3, "0")} extractions
                    </span>
                </div>
            </div>
            <div className="h-2 w-full bg-black flex">
                <div className="h-full w-1/3 bg-[#FF3B30]" />
                <div className="h-full w-1/6 bg-[#FFDF00]" />
                <div className="h-full w-1/6 bg-[#002FA7]" />
                <div className="h-full flex-1 bg-black" />
            </div>
        </header>
    );
}
