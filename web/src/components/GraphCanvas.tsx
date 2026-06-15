import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { useGraphStore } from "../store/useGraphStore";
import {
  deriveFileGraph,
  deriveFunctionGraph,
  type VizGraph,
  type VizNode,
} from "../lib/deriveGraph";
import { CIRCULAR_COLOR } from "../theme";

const EMPTY: VizGraph = {
  nodes: [],
  links: [],
  circularNodeIds: new Set(),
  neighbors: new Map(),
  visibleCount: 0,
  totalCount: 0,
};

// Allow the runtime velocity fields force-graph mutates.
type SimNode = VizNode & { vx?: number; vy?: number; fx?: number; fy?: number };

/** A d3-force that pulls nodes toward their group's centroid (folder clustering). */
function clusterForce(getCenter: (n: SimNode) => { x: number; y: number }) {
  let nodes: SimNode[] = [];
  const force = (alpha: number) => {
    for (const n of nodes) {
      const c = getCenter(n);
      n.vx = (n.vx ?? 0) + (c.x - (n.x ?? 0)) * 0.08 * alpha;
      n.vy = (n.vy ?? 0) + (c.y - (n.y ?? 0)) * 0.08 * alpha;
    }
  };
  force.initialize = (n: SimNode[]) => {
    nodes = n;
  };
  return force;
}

export function GraphCanvas({
  canvasHostRef,
  onVizUpdate,
}: {
  canvasHostRef: (el: HTMLCanvasElement | null) => void;
  onVizUpdate: (viz: VizGraph) => void;
}) {
  const graph = useGraphStore((s) => s.graph);
  const viewMode = useGraphStore((s) => s.viewMode);
  const filters = useGraphStore((s) => s.filters);
  const rules = useGraphStore((s) => s.rules);
  const functionScopeFile = useGraphStore((s) => s.functionScopeFile);
  const selectedId = useGraphStore((s) => s.selectedId);
  const hoverId = useGraphStore((s) => s.hoverId);
  const search = useGraphStore((s) => s.search);
  const showClusters = useGraphStore((s) => s.showClusters);
  const highlightCircular = useGraphStore((s) => s.highlightCircular);
  const setSelected = useGraphStore((s) => s.setSelected);
  const setHover = useGraphStore((s) => s.setHover);

  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const positions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastFit = useRef<string>("");
  const [size, setSize] = useState({ w: 800, h: 600 });

  const viz = useMemo<VizGraph>(() => {
    if (!graph) return EMPTY;
    return viewMode === "function"
      ? deriveFunctionGraph(graph, functionScopeFile)
      : deriveFileGraph(graph, filters, rules);
  }, [graph, viewMode, functionScopeFile, filters, rules]);

  // Hydrate node positions across re-derivations so the layout doesn't jump.
  const graphData = useMemo(() => {
    const nodes = viz.nodes.map((n) => {
      const p = positions.current.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : { ...n };
    });
    return { nodes, links: viz.links.map((l) => ({ ...l })) };
  }, [viz]);

  // Track container size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Expose the underlying canvas to the parent (for PNG export).
  useEffect(() => {
    const canvas = wrapRef.current?.querySelector("canvas") ?? null;
    canvasHostRef(canvas);
  }, [canvasHostRef, size]);

  // Tune forces so the graph spreads out readably.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const charge = fg.d3Force("charge") as unknown as { strength: (s: number) => void; distanceMax: (d: number) => void } | undefined;
    charge?.strength(viewMode === "function" ? -160 : -320);
    charge?.distanceMax(600);
    const link = fg.d3Force("link") as unknown as { distance: (d: number) => void } | undefined;
    link?.distance(viewMode === "function" ? 44 : 70);
    fg.d3ReheatSimulation();
  }, [viewMode, graphData]);

  // Folder clustering.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (showClusters && viz.nodes.length > 0) {
      const groups = [...new Set(viz.nodes.map((n) => n.group))];
      const R = Math.max(220, groups.length * 46);
      const centers = new Map<string, { x: number; y: number }>();
      groups.forEach((g, i) => {
        const a = (i / groups.length) * 2 * Math.PI;
        centers.set(g, { x: Math.cos(a) * R, y: Math.sin(a) * R });
      });
      fg.d3Force("cluster", clusterForce((n) => centers.get(n.group) ?? { x: 0, y: 0 }) as never);
    } else {
      fg.d3Force("cluster", null as never);
    }
    fg.d3ReheatSimulation();
  }, [showClusters, viz]);

  const datasetKey = `${graph?.root}|${viewMode}|${functionScopeFile}`;

  // Fit the view to the graph once per dataset (after layout settles or a fallback timer).
  const maybeFit = useCallback(() => {
    if (lastFit.current === datasetKey) return;
    lastFit.current = datasetKey;
    fgRef.current?.zoomToFit(500, 80);
  }, [datasetKey]);

  useEffect(() => {
    const t = setTimeout(maybeFit, 1500);
    return () => clearTimeout(t);
  }, [maybeFit]);

  // Focus & zoom to a searched node.
  useEffect(() => {
    if (!search.trim()) return;
    const q = search.toLowerCase();
    const match =
      graphData.nodes.find((n) => n.label.toLowerCase() === q) ??
      graphData.nodes.find((n) => n.label.toLowerCase().startsWith(q)) ??
      graphData.nodes.find((n) => n.id.toLowerCase().includes(q));
    const fg = fgRef.current;
    if (match && fg && typeof match.x === "number" && typeof match.y === "number") {
      fg.centerAt(match.x, match.y, 600);
      fg.zoom(4, 600);
    }
  }, [search, graphData]);

  const savePositions = useCallback(() => {
    for (const n of graphData.nodes as SimNode[]) {
      if (typeof n.x === "number" && typeof n.y === "number") {
        positions.current.set(n.id, { x: n.x, y: n.y });
      }
    }
    onVizUpdate({ ...viz, nodes: graphData.nodes as VizNode[], links: graphData.links as VizGraph["links"] });
  }, [graphData, viz, onVizUpdate]);

  const nodeIdSet = useMemo(() => new Set(viz.nodes.map((n) => n.id)), [viz]);
  const rawFocus = hoverId ?? selectedId;
  // Only treat a node as "focused" if it actually exists in the current view.
  const focusId = rawFocus && nodeIdSet.has(rawFocus) ? rawFocus : null;

  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, scale: number) => {
      const n = node as SimNode;
      if (typeof n.x !== "number" || typeof n.y !== "number") return;
      const isCircular = highlightCircular && viz.circularNodeIds.has(n.id);

      let dim = false;
      if (focusId && focusId !== n.id) {
        const nb = viz.neighbors.get(focusId);
        dim = !(nb && nb.has(n.id));
      }
      const searchMatch =
        search.trim().length > 0 && n.label.toLowerCase().includes(search.toLowerCase());

      const r = Math.max(2, n.val);
      ctx.globalAlpha = dim ? 0.1 : 1;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isCircular ? CIRCULAR_COLOR : n.color;
      ctx.fill();

      if (n.id === selectedId || (focusId === n.id) || searchMatch) {
        ctx.lineWidth = 2 / scale;
        ctx.strokeStyle =
          n.id === selectedId ? "#ffffff" : searchMatch ? "#fde047" : "#e2e8f0";
        ctx.stroke();
      }

      const showLabel = scale > 1.6 || r > 6 || n.id === focusId || searchMatch;
      if (showLabel && !dim) {
        const fontSize = Math.min(5.5, 12 / scale);
        ctx.font = `${fontSize}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(n.label, n.x, n.y - r - 1.5);
      }
      ctx.globalAlpha = 1;
    },
    [viz, focusId, selectedId, search, highlightCircular],
  );

  const paintPointerArea = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as SimNode;
      if (typeof n.x !== "number" || typeof n.y !== "number") return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(3, n.val) + 1.5, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  if (!graph) return <div ref={wrapRef} className="h-full w-full" />;

  return (
    <div ref={wrapRef} className="h-full w-full">
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="#0b0e16"
        nodeId="id"
        nodeRelSize={1}
        nodeVal={(n: object) => (n as VizNode).val}
        nodeLabel={(n: object) => (n as VizNode).id}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintPointerArea}
        linkColor={(l: object) => {
          const link = l as { circular?: boolean; source: SimNode; target: SimNode };
          if (focusId) {
            const incident = link.source?.id === focusId || link.target?.id === focusId;
            if (!incident) return "rgba(120,140,170,0.05)";
          }
          return link.circular ? CIRCULAR_COLOR : "rgba(130,150,180,0.22)";
        }}
        linkWidth={(l: object) => ((l as { circular?: boolean }).circular ? 1.6 : 0.7)}
        linkDirectionalArrowLength={viewMode === "function" ? 3 : 2.4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(l: object) => ((l as { circular?: boolean }).circular ? 2 : 0)}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleColor={() => CIRCULAR_COLOR}
        onNodeClick={(n: object) => {
          const node = n as VizNode;
          setSelected(node.id);
          if (typeof node.x === "number" && typeof node.y === "number") {
            fgRef.current?.centerAt(node.x, node.y, 500);
          }
        }}
        onNodeHover={(n: object | null) => setHover(n ? (n as VizNode).id : null)}
        onNodeDragEnd={(n: object) => {
          const node = n as SimNode;
          node.fx = node.x;
          node.fy = node.y;
          savePositions();
        }}
        onEngineStop={() => {
          savePositions();
          maybeFit();
        }}
        onBackgroundClick={() => setSelected(null)}
        cooldownTime={viewMode === "function" ? 4000 : 6000}
      />
    </div>
  );
}
