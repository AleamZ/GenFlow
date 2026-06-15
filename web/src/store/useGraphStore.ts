import { create } from "zustand";
import type { Filters, GraphJSON, NodeType, Rule, ViewMode } from "../types";
import { fetchGraph, uploadZip, type GraphRequest } from "../api";
import { bridge } from "../platform";

const RULES_KEY = "genflow.rules.v1";

function loadRules(): Rule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? (JSON.parse(raw) as Rule[]) : [];
  } catch {
    return [];
  }
}

function saveRules(rules: Rule[]): void {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));
  } catch {
    /* ignore */
  }
}

const DEFAULT_FILTERS: Filters = {
  hiddenTypes: [],
  hideExternal: false,
  minFanIn: 0,
  folder: null,
};

export interface GraphState {
  graph: GraphJSON | null;
  sourceRoot: string;
  sourceLabel: string;
  loading: boolean;
  error: string | null;

  viewMode: ViewMode;
  selectedId: string | null;
  hoverId: string | null;
  search: string;
  filters: Filters;
  rules: Rule[];
  showClusters: boolean;
  highlightCircular: boolean;
  functionScopeFile: string | null;

  /** Desktop: file watcher active. */
  watching: boolean;
  /** Desktop: a live re-analysis is currently running. */
  analyzing: boolean;

  loadGraph: (req?: GraphRequest, label?: string) => Promise<void>;
  loadUpload: (file: File) => Promise<void>;
  /** Desktop: open a native folder picker, analyze it, and start watching. */
  openFolder: () => Promise<void>;
  /** Desktop: start/stop the file watcher for the current root. */
  toggleWatch: () => Promise<void>;
  /** Desktop: apply a live graph update without losing selection/view. */
  applyLiveGraph: (graph: GraphJSON) => void;
  setAnalyzing: (on: boolean) => void;

  setViewMode: (mode: ViewMode) => void;
  setSelected: (id: string | null) => void;
  setHover: (id: string | null) => void;
  setSearch: (q: string) => void;
  setFilters: (partial: Partial<Filters>) => void;
  toggleType: (type: NodeType) => void;
  setShowClusters: (on: boolean) => void;
  setHighlightCircular: (on: boolean) => void;
  setFunctionScopeFile: (file: string | null) => void;

  addRule: (rule: Rule) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  removeRule: (id: string) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graph: null,
  sourceRoot: "",
  sourceLabel: "",
  loading: false,
  error: null,

  viewMode: "file",
  selectedId: null,
  hoverId: null,
  search: "",
  filters: DEFAULT_FILTERS,
  rules: loadRules(),
  showClusters: false,
  highlightCircular: true,
  functionScopeFile: null,
  watching: false,
  analyzing: false,

  loadGraph: async (req = {}, label) => {
    set({ loading: true, error: null });
    try {
      const graph = await fetchGraph(req);
      set({
        graph,
        sourceRoot: graph.root,
        sourceLabel: label ?? req.path ?? "sample-project",
        loading: false,
        selectedId: null,
        functionScopeFile: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  loadUpload: async (file) => {
    set({ loading: true, error: null });
    try {
      const graph = await uploadZip(file);
      set({
        graph,
        sourceRoot: graph.upload?.root ?? graph.root,
        sourceLabel: graph.upload?.name ?? file.name,
        loading: false,
        selectedId: null,
        functionScopeFile: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  openFolder: async () => {
    if (!bridge) return;
    const folder = await bridge.openFolder();
    if (!folder) return;
    await get().loadGraph({ path: folder }, folder);
    if (!get().error) {
      await bridge.startWatch(folder);
      set({ watching: true });
    }
  },

  toggleWatch: async () => {
    if (!bridge) return;
    const { watching, graph } = get();
    if (watching) {
      await bridge.stopWatch();
      set({ watching: false });
    } else if (graph) {
      await bridge.startWatch(graph.root);
      set({ watching: true });
    }
  },

  applyLiveGraph: (graph) =>
    set((s) => ({
      graph,
      sourceRoot: graph.root || s.sourceRoot,
      analyzing: false,
      // keep selectedId, viewMode, filters, rules, functionScopeFile untouched
    })),

  setAnalyzing: (on) => set({ analyzing: on }),

  setViewMode: (mode) => {
    // When switching into function view, scope to the selected file if any.
    const { selectedId, graph } = get();
    let scope: string | null = null;
    if (mode === "function" && selectedId && graph) {
      const node = graph.nodes.find((n) => n.id === selectedId);
      if (node && !node.isExternal) scope = node.id;
    }
    set({ viewMode: mode, functionScopeFile: scope });
  },
  setSelected: (id) => set({ selectedId: id }),
  setHover: (id) => set({ hoverId: id }),
  setSearch: (q) => set({ search: q }),
  setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
  toggleType: (type) =>
    set((s) => {
      const hidden = new Set(s.filters.hiddenTypes);
      if (hidden.has(type)) hidden.delete(type);
      else hidden.add(type);
      return { filters: { ...s.filters, hiddenTypes: [...hidden] } };
    }),
  setShowClusters: (on) => set({ showClusters: on }),
  setHighlightCircular: (on) => set({ highlightCircular: on }),
  setFunctionScopeFile: (file) => set({ functionScopeFile: file }),

  addRule: (rule) =>
    set((s) => {
      const rules = [...s.rules, rule];
      saveRules(rules);
      return { rules };
    }),
  updateRule: (id, patch) =>
    set((s) => {
      const rules = s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
      saveRules(rules);
      return { rules };
    }),
  removeRule: (id) =>
    set((s) => {
      const rules = s.rules.filter((r) => r.id !== id);
      saveRules(rules);
      return { rules };
    }),
}));
