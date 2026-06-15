// Canonical graph schema produced by the analyzer and consumed by the web app.
// This file is the single source of truth; web/src/types.ts mirrors it.

export type NodeType =
  | "entrypoint"
  | "service"
  | "component"
  | "hook"
  | "util"
  | "store"
  | "config"
  | "external"
  | "module";

export type EdgeKind = "import" | "require" | "reexport" | "dynamic-import" | "call";

/** A node in the file-level dependency graph. */
export interface FileNode {
  /** Posix relative path from root, or "ext:<pkg>" for external packages. */
  id: string;
  /** Display name (basename, or package name for external). */
  label: string;
  type: NodeType;
  /** Posix directory of the file (used for folder clustering). "." for root files. */
  group: string;
  /** Non-blank lines of code (0 for external). */
  loc: number;
  /** Number of distinct internal files importing this node. */
  fanIn: number;
  /** Number of distinct internal files this node imports. */
  fanOut: number;
  /** Number of distinct external packages this node imports. */
  externalDeps: number;
  level: "file";
  isExternal: boolean;
  /** Absolute path on disk (omitted for external nodes). */
  path?: string;
}

export interface FileEdge {
  source: string;
  target: string;
  kind: EdgeKind;
}

/** A node in the function-level call graph. */
export interface FunctionNode {
  /** "<relPath>#<name>" (with a numeric suffix if names collide in a file). */
  id: string;
  /** Posix relative path of the containing file. */
  file: string;
  label: string;
  line: number;
  loc: number;
  exported: boolean;
  level: "function";
}

export interface FunctionEdge {
  source: string;
  target: string;
  kind: "call";
}

export interface FunctionGraph {
  nodes: FunctionNode[];
  edges: FunctionEdge[];
}

export interface GodFile {
  id: string;
  fanIn: number;
  fanOut: number;
}

export interface GraphIssues {
  /** Each cycle is an ordered list of node ids, with the first node repeated at the end. */
  circular: string[][];
  /** Internal nodes with no edges at all (fanIn === 0 && fanOut === 0). */
  orphans: string[];
  godFiles: GodFile[];
}

export interface GraphMeta {
  fileCount: number;
  externalCount: number;
  edgeCount: number;
  functionCount: number;
  functionEdgeCount: number;
  languages: string[];
  /** Calls that could not be statically resolved (dynamic/computed). */
  skippedDynamicCalls: number;
  analyzedAt: string;
  durationMs: number;
}

export interface GraphJSON {
  version: string;
  root: string;
  meta: GraphMeta;
  nodes: FileNode[];
  edges: FileEdge[];
  functions: FunctionGraph;
  issues: GraphIssues;
}

export interface AnalyzeOptions {
  /** Absolute path to the project root. */
  root: string;
  includeFunctions: boolean;
  includeTests: boolean;
  /** fanIn at/above which a file is flagged as a "god file" (default 10). */
  godFileFanIn: number;
  /** fanOut at/above which a file is flagged as a "god file" (default 15). */
  godFileFanOut: number;
  /** Extra glob patterns to ignore. */
  extraIgnores: string[];
}

export const GRAPH_VERSION = "1.0";

export const DEFAULT_ANALYZE_OPTIONS: Omit<AnalyzeOptions, "root"> = {
  includeFunctions: true,
  includeTests: false,
  godFileFanIn: 10,
  godFileFanOut: 15,
  extraIgnores: [],
};
