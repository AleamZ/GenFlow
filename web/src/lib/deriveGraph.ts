import type {
  EdgeKind,
  Filters,
  FileNode,
  FunctionNode,
  GraphJSON,
  NodeType,
} from "../types";
import { colorForType } from "../theme";
import { applyRules, compileRules } from "./rules";

export interface VizNode {
  id: string;
  label: string;
  color: string;
  /** Force/size metric. */
  val: number;
  type: NodeType;
  group: string;
  kind: "file" | "function";
  meta: FileNode | FunctionNode;
  // mutated by force-graph at runtime:
  x?: number;
  y?: number;
}

export interface VizLink {
  source: string;
  target: string;
  kind: EdgeKind;
  circular: boolean;
}

export interface VizGraph {
  nodes: VizNode[];
  links: VizLink[];
  circularNodeIds: Set<string>;
  neighbors: Map<string, Set<string>>;
  visibleCount: number;
  totalCount: number;
}

function addNeighbor(map: Map<string, Set<string>>, a: string, b: string): void {
  let s = map.get(a);
  if (!s) map.set(a, (s = new Set()));
  s.add(b);
}

function fileNodeVal(n: FileNode): number {
  return Math.max(2, Math.sqrt(n.fanIn + 1) * 2.2);
}

/** Build the file-level view graph honoring filters + custom rules. */
export function deriveFileGraph(graph: GraphJSON, filters: Filters, rules: Parameters<typeof compileRules>[0]): VizGraph {
  const compiled = compileRules(rules);

  // Circular metadata.
  const circularNodeIds = new Set<string>();
  const circularEdges = new Set<string>();
  for (const cyc of graph.issues.circular) {
    for (let i = 0; i < cyc.length - 1; i++) {
      circularNodeIds.add(cyc[i]);
      circularEdges.add(`${cyc[i]}->${cyc[i + 1]}`);
    }
  }

  const visible = new Set<string>();
  const nodes: VizNode[] = [];

  for (const n of graph.nodes) {
    const eff = applyRules(n, compiled);
    if (filters.hideExternal && n.isExternal) continue;
    if (filters.hiddenTypes.includes(eff.type)) continue;
    if (n.fanIn < filters.minFanIn) continue;
    if (
      filters.folder &&
      !(n.group === filters.folder || n.group.startsWith(filters.folder + "/"))
    ) {
      continue;
    }
    visible.add(n.id);
    nodes.push({
      id: n.id,
      label: n.label,
      color: eff.color,
      val: fileNodeVal(n),
      type: eff.type,
      group: eff.group,
      kind: "file",
      meta: n,
    });
  }

  const links: VizLink[] = [];
  const neighbors = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!visible.has(e.source) || !visible.has(e.target)) continue;
    links.push({
      source: e.source,
      target: e.target,
      kind: e.kind,
      circular: circularEdges.has(`${e.source}->${e.target}`),
    });
    addNeighbor(neighbors, e.source, e.target);
    addNeighbor(neighbors, e.target, e.source);
  }

  return {
    nodes,
    links,
    circularNodeIds,
    neighbors,
    visibleCount: nodes.length,
    totalCount: graph.nodes.length,
  };
}

/**
 * Build the function-level call graph. When scopeFile is set, show only that
 * file's functions plus their direct call neighbors (1 hop) to stay readable.
 */
export function deriveFunctionGraph(graph: GraphJSON, scopeFile: string | null): VizGraph {
  const fns = graph.functions;

  // Color functions by the type of their containing file.
  const fileType = new Map<string, NodeType>();
  for (const fn of graph.nodes) fileType.set(fn.id, fn.type);

  let nodeIds: Set<string>;
  if (scopeFile) {
    const set = new Set(fns.nodes.filter((n) => n.file === scopeFile).map((n) => n.id));
    for (const e of fns.edges) {
      if (set.has(e.source)) set.add(e.target);
      if (set.has(e.target)) set.add(e.source);
    }
    nodeIds = set;
  } else {
    nodeIds = new Set(fns.nodes.map((n) => n.id));
  }

  const nodes: VizNode[] = fns.nodes
    .filter((n) => nodeIds.has(n.id))
    .map((n) => {
      const type = fileType.get(n.file) ?? "module";
      return {
        id: n.id,
        label: n.label,
        color: colorForType(type),
        val: Math.max(2, Math.sqrt(n.loc / 6 + 1) * 1.6),
        type,
        group: n.file,
        kind: "function" as const,
        meta: n,
      };
    });

  const neighbors = new Map<string, Set<string>>();
  const links: VizLink[] = [];
  for (const e of fns.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    links.push({ source: e.source, target: e.target, kind: "call", circular: false });
    addNeighbor(neighbors, e.source, e.target);
    addNeighbor(neighbors, e.target, e.source);
  }

  return {
    nodes,
    links,
    circularNodeIds: new Set(),
    neighbors,
    visibleCount: nodes.length,
    totalCount: fns.nodes.length,
  };
}
