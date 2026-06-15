import { AlertTriangle, RefreshCcw, Ghost } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";

export function IssuesPanel() {
  const graph = useGraphStore((s) => s.graph);
  const setSelected = useGraphStore((s) => s.setSelected);
  if (!graph) return null;
  const { circular, orphans, godFiles } = graph.issues;

  const baseName = (id: string) => id.split("/").pop() ?? id;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-rose-400">
          <RefreshCcw size={13} /> Circular ({circular.length})
        </div>
        {circular.length === 0 ? (
          <p className="text-xs text-muted">None 🎉</p>
        ) : (
          <ul className="space-y-1.5">
            {circular.map((cyc, i) => (
              <li key={i} className="rounded bg-rose-500/10 p-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-1">
                  {cyc.map((id, j) => (
                    <span key={j} className="flex items-center gap-1">
                      <button
                        onClick={() => setSelected(id)}
                        className="rounded bg-rose-500/15 px-1 text-rose-200 hover:bg-rose-500/30"
                        title={id}
                      >
                        {baseName(id)}
                      </button>
                      {j < cyc.length - 1 && <span className="text-rose-400/70">→</span>}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-300">
          <AlertTriangle size={13} /> God files ({godFiles.length})
        </div>
        {godFiles.length === 0 ? (
          <p className="text-xs text-muted">None over threshold.</p>
        ) : (
          <ul className="space-y-1">
            {godFiles.slice(0, 12).map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => setSelected(g.id)}
                  className="flex w-full items-center justify-between rounded px-1 py-0.5 text-xs hover:bg-panel2"
                >
                  <span className="truncate" title={g.id}>
                    {baseName(g.id)}
                  </span>
                  <span className="tabular text-muted">
                    ↓{g.fanIn} ↑{g.fanOut}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-300">
          <Ghost size={13} /> Orphans ({orphans.length})
        </div>
        {orphans.length === 0 ? (
          <p className="text-xs text-muted">None.</p>
        ) : (
          <ul className="space-y-1">
            {orphans.slice(0, 12).map((id) => (
              <li key={id}>
                <button
                  onClick={() => setSelected(id)}
                  className="w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-panel2"
                  title={id}
                >
                  {baseName(id)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
