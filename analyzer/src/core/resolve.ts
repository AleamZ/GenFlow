import { ts } from "ts-morph";
import { fsKey } from "./paths.js";
import type { ProjectContext } from "./project.js";

export type ResolveResult =
  | { kind: "internal"; rel: string }
  | { kind: "external"; pkg: string }
  | { kind: "skip" };

function isRelative(spec: string): boolean {
  return spec.startsWith(".") || spec.startsWith("/");
}

/** Whether a specifier is a bare npm package (vs relative or a tsconfig alias). */
function looksLikePackage(spec: string): boolean {
  return !isRelative(spec);
}

/** Extract the package name from a bare specifier (handles scopes and subpaths). */
export function packageNameOf(spec: string): string {
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    return parts.slice(0, 2).join("/");
  }
  return spec.split("/")[0];
}

/**
 * Resolve a module specifier from a containing file into one of:
 *  - internal: a file inside the analyzed project (edge to that file)
 *  - external: an npm package (edge to an "ext:<pkg>" node)
 *  - skip: relative/alias that resolved to something outside our file set (asset,
 *    excluded test, node_modules type stub) — no edge fabricated.
 */
export function resolveSpecifier(
  ctx: ProjectContext,
  spec: string,
  containingFile: string,
): ResolveResult {
  const resolved = ts.resolveModuleName(
    spec,
    containingFile,
    ctx.compilerOptions,
    ts.sys,
    ctx.moduleResolutionCache,
  );

  const fileName = resolved.resolvedModule?.resolvedFileName;
  if (fileName && !fileName.includes("/node_modules/")) {
    const rel = ctx.fileKeyToRel.get(fsKey(fileName));
    if (rel) return { kind: "internal", rel };
    // Resolved to a real file but one we didn't scan (excluded). Don't fabricate.
    return { kind: "skip" };
  }

  // Resolved into node_modules, or could not resolve a relative path.
  if (looksLikePackage(spec)) {
    return { kind: "external", pkg: packageNameOf(spec) };
  }

  // Relative/alias specifier that didn't resolve to a scanned file.
  return { kind: "skip" };
}
