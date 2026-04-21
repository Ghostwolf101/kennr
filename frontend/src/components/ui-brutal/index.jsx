import React from "react";

export const BrutalCard = ({ className = "", children, ...rest }) => (
    <div
        className={`bg-white brutal-border brutal-shadow ${className}`}
        {...rest}
    >
        {children}
    </div>
);

export const BrutalButton = ({
    className = "",
    variant = "default",
    children,
    disabled,
    ...rest
}) => {
    const base =
        "inline-flex items-center justify-center gap-2 px-5 py-3 brutal-border font-mono font-semibold text-sm uppercase tracking-wider select-none";
    const vClass = {
        default: "bg-white text-black brutal-shadow brutal-hover",
        primary:
            "bg-[#FF3B30] text-white brutal-shadow brutal-hover",
        accent: "bg-[#FFDF00] text-black brutal-shadow brutal-hover",
        secondary:
            "bg-[#002FA7] text-white brutal-shadow brutal-hover",
        ghost: "bg-transparent text-black hover:bg-black hover:text-white",
    }[variant];
    return (
        <button
            className={`${base} ${vClass} ${
                disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            } ${className}`}
            disabled={disabled}
            {...rest}
        >
            {children}
        </button>
    );
};

export const BrutalInput = ({ className = "", ...rest }) => (
    <input
        className={`w-full bg-white brutal-border px-3 py-2 font-mono text-sm placeholder:text-[#999] focus:outline-none focus:border-[#FF3B30] ${className}`}
        {...rest}
    />
);

export const BrutalTextarea = ({ className = "", ...rest }) => (
    <textarea
        className={`w-full bg-white brutal-border px-3 py-2 font-mono text-xs placeholder:text-[#999] focus:outline-none focus:border-[#FF3B30] resize-y ${className}`}
        {...rest}
    />
);

export const Overline = ({ children, className = "" }) => (
    <div
        className={`overline font-mono text-[#555] ${className}`}
    >
        {children}
    </div>
);

export const BrutalLoader = ({ label = "EXTRACTING" }) => (
    <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider">
        <div className="flex gap-1 brutal-pulse">
            <span className="block w-3 h-3 bg-black" />
            <span className="block w-3 h-3 bg-[#FF3B30]" />
            <span className="block w-3 h-3 bg-black" />
            <span className="block w-3 h-3 bg-[#FFDF00]" />
        </div>
        <span>{label}...</span>
    </div>
);

export const Tag = ({ children, tone = "default" }) => {
    const tones = {
        default: "bg-white text-black",
        primary: "bg-[#FF3B30] text-white",
        accent: "bg-[#FFDF00] text-black",
        secondary: "bg-[#002FA7] text-white",
        muted: "bg-[#F0F0F0] text-black",
        black: "bg-black text-white",
    };
    return (
        <span
            className={`inline-block brutal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tones[tone]}`}
        >
            {children}
        </span>
    );
};
