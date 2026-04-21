import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    Folder,
    FolderOpen,
    Plus,
    Trash,
    PencilSimple,
    Check,
    X,
    Dna,
} from "@phosphor-icons/react";
import { BrutalCard, BrutalButton, Overline, Tag } from "./ui-brutal";
import {
    listProjects,
    createProject,
    updateProject,
    deleteProject,
    analyzeProjectDna,
} from "@/lib/api";

export default function ProjectsBar({
    activeProjectId,
    onSelect,
    onProjectChanged,
    onDnaSynthesized,
    extractionCount,
}) {
    const [projects, setProjects] = useState([]);
    const [newName, setNewName] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [dnaLoading, setDnaLoading] = useState(false);

    const refresh = async () => {
        try {
            const data = await listProjects();
            setProjects(data);
        } catch (e) {
            // silent
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const createNew = async () => {
        const n = newName.trim();
        if (!n) return;
        try {
            const p = await createProject(n);
            setNewName("");
            await refresh();
            onSelect?.(p.id);
            toast.success(`Project "${n}" created`);
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "Create failed",
            );
        }
    };

    const rename = async (id) => {
        const n = editName.trim();
        if (!n) return;
        try {
            await updateProject(id, { name: n });
            setEditingId(null);
            setEditName("");
            await refresh();
            onProjectChanged?.();
            toast.success("Renamed");
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "Rename failed",
            );
        }
    };

    const remove = async (id) => {
        if (!window.confirm("Delete this project? (extractions stay)")) return;
        try {
            await deleteProject(id);
            await refresh();
            if (activeProjectId === id) onSelect?.(null);
            toast.success("Project deleted");
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "Delete failed",
            );
        }
    };

    const synthDna = async (id) => {
        setDnaLoading(true);
        try {
            const res = await analyzeProjectDna(id);
            onDnaSynthesized?.(res);
            await refresh();
            toast.success("Project DNA synthesized");
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || "DNA failed",
            );
        } finally {
            setDnaLoading(false);
        }
    };

    const active = projects.find((p) => p.id === activeProjectId);

    return (
        <BrutalCard className="p-4" data-testid="projects-bar">
            <div className="flex items-center gap-2 mb-3">
                <Folder size={18} />
                <Overline>projects</Overline>
                <div className="flex-1" />
                <Tag tone="muted">{projects.length}</Tag>
            </div>

            <div className="flex gap-0 mb-3 brutal-border">
                <input
                    type="text"
                    placeholder="new project name…"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createNew()}
                    className="flex-1 px-3 py-2 font-mono text-xs focus:outline-none"
                    data-testid="new-project-input"
                />
                <button
                    onClick={createNew}
                    disabled={!newName.trim()}
                    className="px-3 bg-black text-white font-mono text-xs uppercase disabled:opacity-40 hover:bg-[#FF3B30]"
                    data-testid="create-project-btn"
                >
                    <Plus size={14} />
                </button>
            </div>

            <div className="brutal-border max-h-64 overflow-auto">
                {projects.length === 0 && (
                    <div className="p-3 font-mono text-[11px] text-[#999] text-center">
                        no projects yet
                    </div>
                )}
                {projects.map((p) => {
                    const isActive = p.id === activeProjectId;
                    const isEditing = editingId === p.id;
                    return (
                        <div
                            key={p.id}
                            className={`flex items-center gap-2 px-3 py-2 brutal-border border-l-0 border-r-0 border-t-0 last:border-b-0 ${
                                isActive
                                    ? "bg-black text-white"
                                    : "bg-white hover:bg-[#F0F0F0]"
                            }`}
                            data-testid={`project-row-${p.id}`}
                        >
                            {isActive ? (
                                <FolderOpen size={14} />
                            ) : (
                                <Folder size={14} />
                            )}

                            {isEditing ? (
                                <div className="flex-1 flex gap-1">
                                    <input
                                        value={editName}
                                        onChange={(e) =>
                                            setEditName(e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            e.key === "Enter" && rename(p.id)
                                        }
                                        className="flex-1 px-2 py-0.5 font-mono text-xs text-black border-2 border-[#FFDF00]"
                                        autoFocus
                                        data-testid={`rename-input-${p.id}`}
                                    />
                                    <button
                                        onClick={() => rename(p.id)}
                                        className="p-1 hover:text-[#FFDF00]"
                                        data-testid={`confirm-rename-${p.id}`}
                                    >
                                        <Check size={12} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingId(null);
                                            setEditName("");
                                        }}
                                        className="p-1 hover:text-[#FF3B30]"
                                        data-testid={`cancel-rename-${p.id}`}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => onSelect?.(p.id)}
                                        className="flex-1 text-left font-mono text-xs truncate"
                                        data-testid={`select-project-${p.id}`}
                                    >
                                        {p.name}
                                    </button>
                                    <span className="text-[10px] font-mono opacity-70">
                                        {p.extraction_ids.length}
                                    </span>
                                    {p.dna_id && (
                                        <Dna size={10} className="opacity-70" />
                                    )}
                                    <button
                                        onClick={() => {
                                            setEditingId(p.id);
                                            setEditName(p.name);
                                        }}
                                        className="opacity-60 hover:opacity-100"
                                        data-testid={`edit-project-${p.id}`}
                                    >
                                        <PencilSimple size={11} />
                                    </button>
                                    <button
                                        onClick={() => remove(p.id)}
                                        className="opacity-60 hover:opacity-100 hover:text-[#FF3B30]"
                                        data-testid={`delete-project-${p.id}`}
                                    >
                                        <Trash size={11} />
                                    </button>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {active && (
                <div className="mt-3 p-3 brutal-border bg-[#FFDF00]">
                    <Overline className="mb-1">
                        active // {active.name}
                    </Overline>
                    <div className="flex items-center justify-between">
                        <div className="font-mono text-xs">
                            {active.extraction_ids.length} extractions
                            {active.dna_id && " · dna ready"}
                        </div>
                        <BrutalButton
                            variant="default"
                            onClick={() => synthDna(active.id)}
                            disabled={
                                dnaLoading ||
                                active.extraction_ids.length === 0
                            }
                            className="!px-3 !py-1 !text-[10px]"
                            data-testid="project-synth-dna-btn"
                        >
                            <Dna size={12} />
                            {dnaLoading ? "…" : "Synth DNA"}
                        </BrutalButton>
                    </div>
                </div>
            )}

            {extractionCount > 0 && !active && (
                <div className="mt-3 p-2 brutal-border border-dashed font-mono text-[10px] text-[#555] text-center">
                    tip: create a project to save extractions
                </div>
            )}
        </BrutalCard>
    );
}

export function useProjectAutoSave(activeProjectId, newExtractionId, refreshTrigger) {
    useEffect(() => {
        if (!activeProjectId || !newExtractionId) return;
        updateProject(activeProjectId, {
            add_extraction_ids: [newExtractionId],
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newExtractionId, activeProjectId]);
}
