import { useCallback, useEffect, useRef } from "react";
import { Loader2, Workflow } from "lucide-react";
import { GraphCanvas } from "./components/GraphCanvas";
import { SidePanel } from "./components/SidePanel";
import { Toolbar } from "./components/Toolbar";
import { SearchBar } from "./components/SearchBar";
import { SourceLoader } from "./components/SourceLoader";
import { StatsBar } from "./components/StatsBar";
import { Section } from "./components/ui";
import { Legend } from "./components/Legend";
import { FilterPanel } from "./components/FilterPanel";
import { RulesPanel } from "./components/RulesPanel";
import { IssuesPanel } from "./components/IssuesPanel";
import { useGraphStore } from "./store/useGraphStore";
import { exportPNG, exportSVG } from "./lib/exportImage";
import type { VizGraph } from "./lib/deriveGraph";

export default function App() {
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const graph = useGraphStore((s) => s.graph);
  const selectedId = useGraphStore((s) => s.selectedId);
  const loading = useGraphStore((s) => s.loading);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vizRef = useRef<VizGraph | null>(null);

  useEffect(() => {
    loadGraph({}, "sample-project");
  }, [loadGraph]);

  const onExportPNG = useCallback(() => exportPNG(canvasRef.current, "genflow-graph.png"), []);
  const onExportSVG = useCallback(() => {
    if (vizRef.current) exportSVG(vizRef.current, "genflow-graph.svg");
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#0b0e16] text-ink">
      <header className="flex shrink-0 flex-col gap-2 border-b border-edge px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-500">
                <Workflow size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-none">GenFlow</h1>
                <p className="text-[10px] text-muted">Code Dependency Visualizer</p>
              </div>
            </div>
            <SourceLoader />
          </div>
          <SearchBar />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatsBar />
          <Toolbar onExportPNG={onExportPNG} onExportSVG={onExportSVG} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-edge bg-panel">
          <Section title="Filters">
            <FilterPanel />
          </Section>
          <Section title="Legend & types">
            <Legend />
          </Section>
          <Section title="Custom rules" defaultOpen={false}>
            <RulesPanel />
          </Section>
          <Section title="Issues">
            <IssuesPanel />
          </Section>
        </aside>

        <main className="relative min-w-0 flex-1">
          {graph ? (
            <GraphCanvas
              canvasHostRef={(el) => {
                canvasRef.current = el;
              }}
              onVizUpdate={(v) => {
                vizRef.current = v;
              }}
            />
          ) : (
            <EmptyState loading={loading} />
          )}
          {graph && <HelpHint />}
        </main>

        {selectedId && <SidePanel />}
      </div>
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="grid h-full place-items-center text-center text-muted">
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-sky-400" size={28} />
          <p className="text-sm">Analyzing project…</p>
        </div>
      ) : (
        <div>
          <p className="text-sm">No graph loaded.</p>
          <p className="mt-1 text-xs">Enter a local path, upload a zip, or click “Sample”.</p>
        </div>
      )}
    </div>
  );
}

function HelpHint() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-edge/60 bg-panel/80 px-2.5 py-1.5 text-[11px] text-muted backdrop-blur">
      drag node · scroll to zoom · click for details · hover to highlight
    </div>
  );
}
