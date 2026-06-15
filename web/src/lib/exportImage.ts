import type { GraphJSON } from "../types";
import type { VizGraph, VizNode } from "./deriveGraph";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(graph: GraphJSON, filename = "graph.json"): void {
  downloadBlob(new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" }), filename);
}

export function exportPNG(canvas: HTMLCanvasElement | null, filename = "graph.png"): void {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, "image/png");
}

/** Build an SVG vector from the current simulated node positions. */
export function exportSVG(viz: VizGraph, filename = "graph.svg"): void {
  const positioned = viz.nodes.filter(
    (n): n is VizNode & { x: number; y: number } =>
      typeof n.x === "number" && typeof n.y === "number",
  );
  if (positioned.length === 0) return;

  const pad = 40;
  const xs = positioned.map((n) => n.x);
  const ys = positioned.map((n) => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX + pad * 2;
  const height = Math.max(...ys) - minY + pad * 2;
  const tx = (x: number) => (x - minX + pad).toFixed(1);
  const ty = (y: number) => (y - minY + pad).toFixed(1);

  const pos = new Map(positioned.map((n) => [n.id, n]));
  const lineEls: string[] = [];
  for (const l of viz.links) {
    const s = pos.get(typeof l.source === "string" ? l.source : (l.source as VizNode).id);
    const t = pos.get(typeof l.target === "string" ? l.target : (l.target as VizNode).id);
    if (!s || !t) continue;
    lineEls.push(
      `<line x1="${tx(s.x)}" y1="${ty(s.y)}" x2="${tx(t.x)}" y2="${ty(t.y)}" stroke="${
        l.circular ? "#f43f5e" : "#3a455c"
      }" stroke-width="${l.circular ? 1.6 : 0.8}" opacity="0.7"/>`,
    );
  }

  const nodeEls = positioned.map((n) => {
    const r = Math.max(2.5, n.val);
    return (
      `<circle cx="${tx(n.x)}" cy="${ty(n.y)}" r="${r.toFixed(1)}" fill="${n.color}" ` +
      `stroke="#0b0e16" stroke-width="0.8"/>` +
      `<text x="${tx(n.x)}" y="${(Number(ty(n.y)) - r - 2).toFixed(1)}" font-size="4" ` +
      `fill="#c5d0e0" text-anchor="middle" font-family="monospace">${escapeXml(n.label)}</text>`
    );
  });

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(0)}" height="${height.toFixed(
      0,
    )}" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}">` +
    `<rect width="100%" height="100%" fill="#0b0e16"/>` +
    `<g>${lineEls.join("")}</g><g>${nodeEls.join("")}</g></svg>`;

  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), filename);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}
