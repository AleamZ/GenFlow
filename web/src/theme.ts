import type { NodeType } from "./types";

export interface TypeStyle {
  color: string;
  label: string;
  description: string;
}

/** Color + legend metadata per node type (dark theme). */
export const TYPE_STYLES: Record<NodeType, TypeStyle> = {
  entrypoint: { color: "#34d399", label: "Entrypoint", description: "App entry / main" },
  service: { color: "#38bdf8", label: "Service", description: "services / api / clients" },
  component: { color: "#a78bfa", label: "Component", description: "UI components / views / pages" },
  hook: { color: "#f472b6", label: "Hook", description: "use* / hooks" },
  store: { color: "#fb923c", label: "Store", description: "state / store / slices" },
  util: { color: "#fbbf24", label: "Util", description: "utils / lib / helpers" },
  config: { color: "#94a3b8", label: "Config", description: "config / env" },
  module: { color: "#2dd4bf", label: "Module", description: "uncategorized module" },
  external: { color: "#64748b", label: "External", description: "npm package" },
};

export const TYPE_ORDER: NodeType[] = [
  "entrypoint",
  "service",
  "component",
  "hook",
  "store",
  "util",
  "config",
  "module",
  "external",
];

export function colorForType(type: NodeType): string {
  return TYPE_STYLES[type]?.color ?? "#2dd4bf";
}

export const CIRCULAR_COLOR = "#f43f5e";
export const HIGHLIGHT_COLOR = "#f8fafc";
