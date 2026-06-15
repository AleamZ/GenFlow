import type { GraphJSON } from "./types";

/** Status pushed from the desktop main process during live re-analysis. */
export interface GenflowStatus {
  state: "analyzing" | "idle" | "error";
  message?: string;
}

/** API exposed by the Electron preload bridge (window.genflow). Absent in the browser. */
export interface GenflowBridge {
  version: string;
  /** Open a native folder picker; returns the chosen path or null. */
  openFolder(): Promise<string | null>;
  /** Analyze a local directory in the main process. */
  analyze(path: string, opts?: { functions?: boolean; includeTests?: boolean }): Promise<GraphJSON>;
  /** Read a file's source for the code preview. */
  readFile(root: string, path: string): Promise<string>;
  /** Start watching a directory; live updates arrive via onGraphUpdate. */
  startWatch(path: string): Promise<void>;
  stopWatch(): Promise<void>;
  /** Subscribe to live graph updates. Returns an unsubscribe function. */
  onGraphUpdate(cb: (graph: GraphJSON) => void): () => void;
  /** Subscribe to analysis status. Returns an unsubscribe function. */
  onStatus(cb: (status: GenflowStatus) => void): () => void;
}

export const bridge: GenflowBridge | undefined =
  typeof window !== "undefined" ? window.genflow : undefined;

export const isDesktop: boolean = !!bridge;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
