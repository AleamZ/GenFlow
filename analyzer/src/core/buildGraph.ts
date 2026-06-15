import fs from "node:fs";
import path from "node:path";
import { scanProject } from "./scan.js";
import { createProjectContext } from "./project.js";
import { buildFileGraph } from "./fileGraph.js";
import { buildCallGraph } from "./callGraph.js";
import { classifyFile, looksLikeEntrypoint } from "./classify.js";
import { computeMetrics } from "./metrics.js";
import { computeIssues } from "./issues.js";
import { basename, posixDirname, relFromRoot, toPosix } from "./paths.js";
import {
  GRAPH_VERSION,
  type AnalyzeOptions,
  type FileNode,
  type FunctionGraph,
  type GraphJSON,
} from "../types.js";

/** Read package.json entry fields and resolve them to internal relPaths. */
function readPackageEntrypoints(root: string, internalIds: Set<string>): Set<string> {
  const entries = new Set<string>();
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) return entries;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return entries;
  }

  const candidates: string[] = [];
  for (const field of ["main", "module", "browser"]) {
    if (typeof pkg[field] === "string") candidates.push(pkg[field] as string);
  }
  const bin = pkg.bin;
  if (typeof bin === "string") candidates.push(bin);
  else if (bin && typeof bin === "object") {
    candidates.push(...Object.values(bin as Record<string, string>));
  }

  for (const c of candidates) {
    const rel = relFromRoot(root, path.resolve(root, c));
    if (internalIds.has(rel)) entries.add(rel);
  }
  return entries;
}

/** Analyze a project directory and produce the canonical graph JSON. */
export function analyzeProject(options: AnalyzeOptions): GraphJSON {
  const start = Date.now();
  const root = toPosix(path.resolve(options.root));

  if (!fs.existsSync(options.root) || !fs.statSync(options.root).isDirectory()) {
    throw new Error(`Not a directory: ${options.root}`);
  }

  const files = scanProject(options.root, {
    includeTests: options.includeTests,
    extraIgnores: options.extraIgnores,
  });

  const ctx = createProjectContext(options.root, files);
  const { edges, internalFiles, externalUsage } = buildFileGraph(ctx);

  const internalIds = new Set(internalFiles.map((f) => f.rel));
  const metrics = computeMetrics(internalIds, edges);
  const entrypoints = readPackageEntrypoints(options.root, internalIds);

  // Internal file nodes.
  const nodes: FileNode[] = internalFiles.map((f) => {
    const m = metrics.get(f.rel)!;
    const isEntry =
      entrypoints.has(f.rel) || (looksLikeEntrypoint(f.rel) && m.fanIn === 0);
    return {
      id: f.rel,
      label: basename(f.rel),
      type: isEntry ? "entrypoint" : classifyFile(f.rel),
      group: posixDirname(f.rel),
      loc: f.loc,
      fanIn: m.fanIn,
      fanOut: m.fanOut,
      externalDeps: m.externalDeps,
      level: "file",
      isExternal: false,
      path: f.absPath,
    };
  });

  // External package nodes.
  for (const [id, importers] of externalUsage) {
    nodes.push({
      id,
      label: id.replace(/^ext:/, ""),
      type: "external",
      group: "external",
      loc: 0,
      fanIn: importers.size,
      fanOut: 0,
      externalDeps: 0,
      level: "file",
      isExternal: true,
    });
  }

  const issues = computeIssues({
    internalIds,
    edges,
    metrics,
    entrypoints,
    godFileFanIn: options.godFileFanIn,
    godFileFanOut: options.godFileFanOut,
  });

  let functions: FunctionGraph = { nodes: [], edges: [] };
  let skippedDynamicCalls = 0;
  if (options.includeFunctions) {
    const callResult = buildCallGraph(ctx);
    functions = callResult.graph;
    skippedDynamicCalls = callResult.skippedDynamicCalls;
  }

  const languages = [...new Set(internalFiles.map((f) => f.ext).filter(Boolean))].sort();

  return {
    version: GRAPH_VERSION,
    root,
    meta: {
      fileCount: internalIds.size,
      externalCount: externalUsage.size,
      edgeCount: edges.length,
      functionCount: functions.nodes.length,
      functionEdgeCount: functions.edges.length,
      languages,
      skippedDynamicCalls,
      analyzedAt: new Date(start).toISOString(),
      durationMs: Date.now() - start,
    },
    nodes,
    edges,
    functions,
    issues,
  };
}
