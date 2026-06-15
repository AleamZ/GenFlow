import { useGraphStore } from "../store/useGraphStore";

export function StatsBar() {
  const graph = useGraphStore((s) => s.graph);
  if (!graph) return null;
  const m = graph.meta;

  const stat = (label: string, value: string | number, accent?: string) => (
    <div className="flex items-baseline gap-1">
      <span className={`tabular text-sm font-semibold ${accent ?? "text-ink"}`}>{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-4">
      {stat("files", m.fileCount)}
      {stat("edges", m.edgeCount)}
      {stat("ext", m.externalCount)}
      {stat("fns", m.functionCount)}
      {stat("circular", graph.issues.circular.length, graph.issues.circular.length ? "text-rose-400" : "text-emerald-400")}
      {stat("orphans", graph.issues.orphans.length, graph.issues.orphans.length ? "text-amber-300" : "text-ink")}
      <span className="text-[11px] text-muted">· {m.durationMs}ms</span>
    </div>
  );
}
