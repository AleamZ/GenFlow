import { basename, posixDirname } from "./paths.js";
import type { NodeType } from "../types.js";

/** Common entrypoint filenames (basenames without extension). */
const ENTRY_BASENAMES = new Set(["index", "main", "app", "server", "bot", "cli"]);

/**
 * Heuristic file classification by path + name.
 * Entrypoints are determined separately (needs package.json + graph topology).
 */
export function classifyFile(rel: string): NodeType {
  const lower = rel.toLowerCase();
  const base = basename(lower);
  const nameNoExt = base.replace(/\.[^.]+$/, "");

  // config
  if (
    /\.config\.[cm]?[jt]sx?$/.test(base) ||
    /(^|\/)config(\/|s\/|\.)/.test(lower) ||
    base.startsWith(".env") ||
    nameNoExt === "tsconfig"
  ) {
    return "config";
  }

  // store / state management
  if (
    /(^|\/)(store|stores|state|redux)(\/|$)/.test(lower) ||
    /\.(slice|store|reducer|atom)\.[cm]?[jt]sx?$/.test(base)
  ) {
    return "store";
  }

  // service / api
  if (
    /(^|\/)(services?|api|clients?|gateways?)(\/|$)/.test(lower) ||
    /\.(service|api|client)\.[cm]?[jt]sx?$/.test(base)
  ) {
    return "service";
  }

  // hook (use* naming or hooks dir)
  if (/(^|\/)hooks?(\/|$)/.test(lower) || /^use[A-Z0-9]/.test(basename(rel))) {
    return "hook";
  }

  // component
  if (
    base.endsWith(".tsx") ||
    base.endsWith(".jsx") ||
    /(^|\/)(components?|views?|pages?|screens?|widgets?)(\/|$)/.test(lower)
  ) {
    return "component";
  }

  // util / lib / helpers
  if (
    /(^|\/)(utils?|lib|libs|helpers?|common|shared)(\/|$)/.test(lower) ||
    /\.(util|utils|helper)\.[cm]?[jt]sx?$/.test(base)
  ) {
    return "util";
  }

  return "module";
}

/** Whether a file looks like a possible entrypoint by its name/location. */
export function looksLikeEntrypoint(rel: string): boolean {
  const nameNoExt = basename(rel).replace(/\.[^.]+$/, "");
  const dir = posixDirname(rel);
  const depth = dir === "." ? 0 : dir.split("/").length;
  // Entry files are usually shallow (root or src/).
  return ENTRY_BASENAMES.has(nameNoExt) && depth <= 1;
}
