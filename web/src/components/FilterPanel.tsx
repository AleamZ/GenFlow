import { useMemo } from "react";
import { useGraphStore } from "../store/useGraphStore";
import { Toggle } from "./ui";

export function FilterPanel() {
  const graph = useGraphStore((s) => s.graph);
  const filters = useGraphStore((s) => s.filters);
  const setFilters = useGraphStore((s) => s.setFilters);

  const folders = useMemo(() => {
    if (!graph) return [];
    const set = new Set<string>();
    for (const n of graph.nodes) {
      if (n.isExternal) continue;
      // include each ancestor folder so users can pick a top-level feature
      const parts = n.group.split("/");
      let acc = "";
      for (const p of parts) {
        acc = acc ? `${acc}/${p}` : p;
        if (acc !== ".") set.add(acc);
      }
    }
    return [...set].sort();
  }, [graph]);

  return (
    <div className="space-y-3">
      <Toggle
        checked={filters.hideExternal}
        onChange={(v) => setFilters({ hideExternal: v })}
        label="Hide external packages"
      />

      <div>
        <label className="mb-1 block text-xs text-muted">
          Min fan-in: <span className="tabular text-ink">{filters.minFanIn}</span>
        </label>
        <input
          type="range"
          min={0}
          max={15}
          value={filters.minFanIn}
          onChange={(e) => setFilters({ minFanIn: Number(e.target.value) })}
          className="w-full accent-sky-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Folder / feature</label>
        <select
          value={filters.folder ?? ""}
          onChange={(e) => setFilters({ folder: e.target.value || null })}
          className="w-full rounded border border-edge bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-sky-500"
        >
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
