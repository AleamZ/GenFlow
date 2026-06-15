import type { FileEdge } from "../types.js";

export interface NodeMetrics {
  fanIn: number;
  fanOut: number;
  externalDeps: number;
}

/**
 * Compute fan-in / fan-out / external-dependency counts.
 * Edges are assumed de-duplicated per (source, target).
 */
export function computeMetrics(
  internalIds: Set<string>,
  edges: FileEdge[],
): Map<string, NodeMetrics> {
  const metrics = new Map<string, NodeMetrics>();
  for (const id of internalIds) {
    metrics.set(id, { fanIn: 0, fanOut: 0, externalDeps: 0 });
  }

  for (const edge of edges) {
    if (!internalIds.has(edge.source)) continue;
    const src = metrics.get(edge.source)!;
    if (internalIds.has(edge.target)) {
      src.fanOut++;
      metrics.get(edge.target)!.fanIn++;
    } else if (edge.target.startsWith("ext:")) {
      src.externalDeps++;
    }
  }

  return metrics;
}
