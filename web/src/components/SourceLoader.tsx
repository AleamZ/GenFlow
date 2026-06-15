import { useRef, useState } from "react";
import { FolderOpen, Upload, Play, RefreshCw, Loader2, Eye, EyeOff, Radio } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";
import { isDesktop } from "../platform";

export function SourceLoader() {
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const loadUpload = useGraphStore((s) => s.loadUpload);
  const openFolder = useGraphStore((s) => s.openFolder);
  const toggleWatch = useGraphStore((s) => s.toggleWatch);
  const watching = useGraphStore((s) => s.watching);
  const analyzing = useGraphStore((s) => s.analyzing);
  const loading = useGraphStore((s) => s.loading);
  const error = useGraphStore((s) => s.error);
  const sourceLabel = useGraphStore((s) => s.sourceLabel);
  const graph = useGraphStore((s) => s.graph);
  const fileRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState("");

  if (isDesktop) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => openFolder()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-sky-500/90 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
            Open folder
          </button>

          {graph && (
            <button
              onClick={() => toggleWatch()}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
                watching
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                  : "border-edge bg-panel text-muted hover:text-ink"
              }`}
              title={watching ? "Watching for changes — click to stop" : "Start watching for changes"}
            >
              {watching ? <Eye size={14} /> : <EyeOff size={14} />}
              {watching ? "Watching" : "Watch off"}
            </button>
          )}

          {analyzing && (
            <span className="flex items-center gap-1.5 text-xs text-sky-300">
              <Radio size={13} className="animate-pulse" /> re-analyzing…
            </span>
          )}
        </div>
        {error && <span className="text-xs text-rose-400">⚠ {error}</span>}
        {!error && sourceLabel && (
          <span className="truncate text-[11px] text-muted" title={sourceLabel}>
            {sourceLabel}
          </span>
        )}
      </div>
    );
  }

  // Web / browser controls.
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="relative">
          <FolderOpen size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && path && loadGraph({ path }, path)}
            placeholder="Local path e.g. D:\\my-project"
            className="w-72 rounded-md border border-edge bg-panel py-1.5 pl-8 pr-2 text-sm text-ink outline-none placeholder:text-muted focus:border-sky-500"
          />
        </div>
        <button
          onClick={() => path && loadGraph({ path }, path)}
          disabled={loading || !path}
          className="flex items-center gap-1 rounded-md bg-sky-500/90 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        >
          <Play size={14} /> Analyze
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-1 rounded-md border border-edge bg-panel px-2.5 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-40"
          title="Upload a .zip"
        >
          <Upload size={14} /> Zip
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadUpload(f);
            e.target.value = "";
          }}
        />

        <button
          onClick={() => loadGraph({}, "sample-project")}
          disabled={loading}
          className="rounded-md border border-edge bg-panel px-2.5 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-40"
        >
          Sample
        </button>

        <button
          onClick={() => loadGraph({ path: path || undefined, refresh: true }, sourceLabel)}
          disabled={loading}
          className="rounded-md border border-edge bg-panel p-1.5 text-muted hover:text-ink disabled:opacity-40"
          title="Re-analyze"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>
      {error && <span className="text-xs text-rose-400">⚠ {error}</span>}
      {!error && sourceLabel && (
        <span className="truncate text-[11px] text-muted">source: {sourceLabel}</span>
      )}
    </div>
  );
}
