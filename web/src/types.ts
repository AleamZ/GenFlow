// Mirror of analyzer/src/types.ts (the analyzer is the source of truth).

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

export interface FileNode {
  id: string;
  label: string;
  type: NodeType;
  group: string;
  loc: number;
  fanIn: number;
  fanOut: number;
  externalDeps: number;
  level: "file";
  isExternal: boolean;
  path?: string;
}

export interface FileEdge {
  source: string;
  target: string;
  kind: EdgeKind;
}

export interface FunctionNode {
  id: string;
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
  circular: string[][];
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
  /** Present only on upload responses. */
  upload?: { name: string; root: string };
}

// ---- UI-only types ----

export type ViewMode = "file" | "function";

export interface Rule {
  id: string;
  name: string;
  /** Regex tested against the node id (path). */
  pattern: string;
  enabled: boolean;
  setType?: NodeType;
  setGroup?: string;
  setColor?: string;
}

export interface Filters {
  /** Node types that are hidden. */
  hiddenTypes: NodeType[];
  hideExternal: boolean;
  minFanIn: number;
  /** Only show nodes whose group starts with this prefix (null = all). */
  folder: string | null;
}

/** A node as rendered by react-force-graph (with runtime position fields it mutates). */
export interface RenderNode extends FileNode {
  color: string;
  val: number;
  // injected by force-graph at runtime:
  x?: number;
  y?: number;
}

export interface RenderLink {
  source: string;
  target: string;
  kind: EdgeKind;
  circular?: boolean;
}
