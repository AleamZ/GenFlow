import { Image, Download, FileJson, Boxes, GitBranch, FolderTree } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";
import { exportJSON } from "../lib/exportImage";

export function Toolbar({
  onExportPNG,
  onExportSVG,
}: {
  onExportPNG: () => void;
  onExportSVG: () => void;
}) {
  const graph = useGraphStore((s) => s.graph);
  const viewMode = useGraphStore((s) => s.viewMode);
  const setViewMode = useGraphStore((s) => s.setViewMode);
  const showClusters = useGraphStore((s) => s.showClusters);
  const setShowClusters = useGraphStore((s) => s.setShowClusters);
  const highlightCircular = useGraphStore((s) => s.highlightCircular);
  const setHighlightCircular = useGraphStore((s) => s.setHighlightCircular);
  const functionScopeFile = useGraphStore((s) => s.functionScopeFile);
  const setFunctionScopeFile = useGraphStore((s) => s.setFunctionScopeFile);

  const disabled = !graph;

  return (
    <div className="flex items-center gap-2">
      {/* View mode toggle */}
      <div className="flex rounded-md border border-edge bg-panel p-0.5 text-xs">
        <button
          onClick={() => setViewMode("file")}
          className={`flex items-center gap-1 rounded px-2 py-1 ${
            viewMode === "file" ? "bg-sky-500/20 text-sky-300" : "text-muted hover:text-ink"
          }`}
        >
          <FolderTree size={13} /> Files
        </button>
        <button
          onClick={() => setViewMode("function")}
          className={`flex items-center gap-1 rounded px-2 py-1 ${
            viewMode === "function" ? "bg-sky-500/20 text-sky-300" : "text-muted hover:text-ink"
          }`}
        >
          <GitBranch size={13} /> Functions
        </button>
      </div>

      {viewMode === "function" && functionScopeFile && (
        <button
          onClick={() => setFunctionScopeFile(null)}
          className="rounded border border-edge bg-panel px-2 py-1 text-xs text-muted hover:text-ink"
          title="Show all functions instead of just this file"
        >
          scope: {functionScopeFile.split("/").pop()} ✕
        </button>
      )}

      <ToolButton active={showClusters} onClick={() => setShowClusters(!showClusters)} title="Cluster by folder">
        <Boxes size={14} /> Cluster
      </ToolButton>
      <ToolButton
        active={highlightCircular}
        onClick={() => setHighlightCircular(!highlightCircular)}
        title="Highlight circular dependencies"
      >
        <GitBranch size={14} /> Cycles
      </ToolButton>

      <div className="mx-1 h-5 w-px bg-edge" />

      <ToolButton onClick={onExportPNG} disabled={disabled} title="Export PNG">
        <Image size={14} /> PNG
      </ToolButton>
      <ToolButton onClick={onExportSVG} disabled={disabled} title="Export SVG">
        <Download size={14} /> SVG
      </ToolButton>
      <ToolButton onClick={() => graph && exportJSON(graph)} disabled={disabled} title="Export JSON">
        <FileJson size={14} /> JSON
      </ToolButton>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition disabled:opacity-40 ${
        active
          ? "border-sky-500/60 bg-sky-500/15 text-sky-300"
          : "border-edge bg-panel text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
