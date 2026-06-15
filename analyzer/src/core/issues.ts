import type { FileEdge, GodFile, GraphIssues } from "../types.js";
import type { NodeMetrics } from "./metrics.js";

/** Build an adjacency map restricted to internal nodes. */
function buildAdjacency(internalIds: Set<string>, edges: FileEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const id of internalIds) adj.set(id, []);
  for (const edge of edges) {
    if (internalIds.has(edge.source) && internalIds.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
    }
  }
  return adj;
}

/**
 * Tarjan's strongly-connected-components algorithm (iterative, to avoid stack
 * overflow on large graphs). Returns SCCs with more than one node, plus single
 * nodes that have a self-edge.
 */
function stronglyConnectedComponents(
  ids: string[],
  adj: Map<string, string[]>,
): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];

  for (const start of ids) {
    if (indices.has(start)) continue;

    // Iterative DFS frame: node + pointer into its successor list.
    const callStack: { node: string; i: number }[] = [{ node: start, i: 0 }];

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      const { node } = frame;

      if (frame.i === 0) {
        indices.set(node, index);
        lowlink.set(node, index);
        index++;
        stack.push(node);
        onStack.add(node);
      }

      const successors = adj.get(node) ?? [];
      if (frame.i < successors.length) {
        const next = successors[frame.i];
        frame.i++;
        if (!indices.has(next)) {
          callStack.push({ node: next, i: 0 });
        } else if (onStack.has(next)) {
          lowlink.set(node, Math.min(lowlink.get(node)!, indices.get(next)!));
        }
      } else {
        // Done exploring `node`; propagate lowlink to parent.
        if (lowlink.get(node) === indices.get(node)) {
          const component: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            component.push(w);
          } while (w !== node);
          result.push(component);
        }
        callStack.pop();
        const parent = callStack[callStack.length - 1];
        if (parent) {
          lowlink.set(parent.node, Math.min(lowlink.get(parent.node)!, lowlink.get(node)!));
        }
      }
    }
  }

  return result;
}

/** Extract one concrete ordered cycle from an SCC (path with first node repeated). */
function extractCycle(component: string[], adj: Map<string, string[]>): string[] {
  const inComponent = new Set(component);
  const start = component[0];
  const path: string[] = [];
  const onPath = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): string[] | null {
    path.push(node);
    onPath.add(node);
    visited.add(node);
    for (const next of adj.get(node) ?? []) {
      if (!inComponent.has(next)) continue;
      if (onPath.has(next)) {
        // Found a back-edge → close the cycle.
        const startIdx = path.indexOf(next);
        return [...path.slice(startIdx), next];
      }
      if (!visited.has(next)) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    path.pop();
    onPath.delete(node);
    return null;
  }

  return dfs(start) ?? [...component, component[0]];
}

export interface ComputeIssuesParams {
  internalIds: Set<string>;
  edges: FileEdge[];
  metrics: Map<string, NodeMetrics>;
  entrypoints: Set<string>;
  godFileFanIn: number;
  godFileFanOut: number;
}

export function computeIssues(params: ComputeIssuesParams): GraphIssues {
  const { internalIds, edges, metrics, godFileFanIn, godFileFanOut } = params;
  const ids = [...internalIds];
  const adj = buildAdjacency(internalIds, edges);

  // Circular dependencies: SCCs of size > 1.
  const sccs = stronglyConnectedComponents(ids, adj);
  const circular: string[][] = sccs
    .filter((c) => c.length > 1)
    .map((c) => extractCycle(c, adj))
    .sort((a, b) => b.length - a.length);

  // Orphans: no edges at all.
  const orphans = ids
    .filter((id) => {
      const m = metrics.get(id)!;
      return m.fanIn === 0 && m.fanOut === 0 && m.externalDeps === 0;
    })
    .sort();

  // God files: unusually high fan-in or fan-out.
  const godFiles: GodFile[] = ids
    .map((id) => ({ id, ...metrics.get(id)! }))
    .filter((m) => m.fanIn >= godFileFanIn || m.fanOut >= godFileFanOut)
    .map(({ id, fanIn, fanOut }) => ({ id, fanIn, fanOut }))
    .sort((a, b) => b.fanIn + b.fanOut - (a.fanIn + a.fanOut));

  return { circular, orphans, godFiles };
}
