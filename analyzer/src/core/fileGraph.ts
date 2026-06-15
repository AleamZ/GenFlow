import path from "node:path";
import { SyntaxKind, type SourceFile } from "ts-morph";
import type { ProjectContext } from "./project.js";
import { resolveSpecifier } from "./resolve.js";
import { fsKey } from "./paths.js";
import type { EdgeKind, FileEdge } from "../types.js";

export interface InternalFileInfo {
  rel: string;
  absPath: string;
  loc: number;
  ext: string;
}

export interface FileGraphResult {
  edges: FileEdge[];
  internalFiles: InternalFileInfo[];
  /** External package id ("ext:<pkg>") -> set of internal files importing it. */
  externalUsage: Map<string, Set<string>>;
}

interface RawDep {
  spec: string;
  kind: EdgeKind;
}

/** Count non-blank lines of source. */
function countLoc(text: string): number {
  let loc = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length > 0) loc++;
  }
  return loc;
}

/** Collect every module specifier (import/require/reexport/dynamic-import) in a file. */
function collectRawDeps(sf: SourceFile): RawDep[] {
  const deps: RawDep[] = [];

  for (const imp of sf.getImportDeclarations()) {
    deps.push({ spec: imp.getModuleSpecifierValue(), kind: "import" });
  }

  for (const exp of sf.getExportDeclarations()) {
    const spec = exp.getModuleSpecifierValue();
    if (spec) deps.push({ spec, kind: "reexport" });
  }

  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    const args = call.getArguments();
    const first = args[0];
    const firstString =
      first && first.getKind() === SyntaxKind.StringLiteral
        ? first.asKind(SyntaxKind.StringLiteral)!.getLiteralValue()
        : undefined;
    if (firstString === undefined) continue;

    if (expr.getKind() === SyntaxKind.ImportKeyword) {
      deps.push({ spec: firstString, kind: "dynamic-import" });
    } else if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === "require") {
      deps.push({ spec: firstString, kind: "require" });
    }
  }

  return deps;
}

/** Build internal->internal and internal->external edges from import statements. */
export function buildFileGraph(ctx: ProjectContext): FileGraphResult {
  const edges: FileEdge[] = [];
  const internalFiles: InternalFileInfo[] = [];
  const externalUsage = new Map<string, Set<string>>();
  const seenEdge = new Set<string>();

  for (const sf of ctx.project.getSourceFiles()) {
    const rel = ctx.fileKeyToRel.get(fsKey(sf.getFilePath()));
    if (!rel) continue; // not a scanned project file

    const absPath = sf.getFilePath();
    internalFiles.push({
      rel,
      absPath,
      loc: countLoc(sf.getFullText()),
      ext: path.extname(rel).replace(".", ""),
    });

    for (const dep of collectRawDeps(sf)) {
      const result = resolveSpecifier(ctx, dep.spec, absPath);
      let target: string | undefined;

      if (result.kind === "internal") {
        if (result.rel === rel) continue; // ignore self-import
        target = result.rel;
      } else if (result.kind === "external") {
        target = `ext:${result.pkg}`;
        let set = externalUsage.get(target);
        if (!set) externalUsage.set(target, (set = new Set()));
        set.add(rel);
      } else {
        continue; // skip
      }

      const key = `${rel}->${target}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push({ source: rel, target, kind: dep.kind });
    }
  }

  return { edges, internalFiles, externalUsage };
}
