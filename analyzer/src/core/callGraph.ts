import { SyntaxKind, Node, type SourceFile } from "ts-morph";
import type { ProjectContext } from "./project.js";
import { fsKey } from "./paths.js";
import type { FunctionEdge, FunctionGraph, FunctionNode } from "../types.js";

interface DeclEntry {
  id: string;
  node: Node;
}

/** A declaration node that we treat as a callable function unit. */
function functionLoc(node: Node): number {
  return Math.max(1, node.getEndLineNumber() - node.getStartLineNumber() + 1);
}

/** Collect function-like declarations from a source file into nodes + a node->id map. */
function collectFunctions(
  sf: SourceFile,
  rel: string,
  nodes: FunctionNode[],
  declToId: Map<Node, string>,
): DeclEntry[] {
  const entries: DeclEntry[] = [];
  const usedIds = new Set<string>();

  const register = (
    name: string,
    declNode: Node,
    locNode: Node,
    exported: boolean,
  ): void => {
    let id = `${rel}#${name}`;
    if (usedIds.has(id)) id = `${rel}#${name}@${declNode.getStartLineNumber()}`;
    usedIds.add(id);
    nodes.push({
      id,
      file: rel,
      label: name,
      line: declNode.getStartLineNumber(),
      loc: functionLoc(locNode),
      exported,
      level: "function",
    });
    declToId.set(declNode, id);
    entries.push({ id, node: declNode });
  };

  // function declarations
  for (const fn of sf.getFunctions()) {
    const name = fn.getName() ?? (fn.isDefaultExport() ? "default" : undefined);
    if (!name) continue;
    register(name, fn, fn, fn.isExported());
  }

  // arrow / function expressions assigned to a variable
  for (const vd of sf.getVariableDeclarations()) {
    const init = vd.getInitializer();
    if (
      init &&
      (init.getKind() === SyntaxKind.ArrowFunction ||
        init.getKind() === SyntaxKind.FunctionExpression)
    ) {
      const exported = vd.getVariableStatement()?.isExported() ?? false;
      register(vd.getName(), vd, vd, exported);
    }
  }

  // class methods
  for (const cls of sf.getClasses()) {
    const className = cls.getName() ?? "anonymous";
    const exported = cls.isExported();
    for (const method of cls.getMethods()) {
      register(`${className}.${method.getName()}`, method, method, exported);
    }
  }

  return entries;
}

/** Resolve the symbol behind a call expression's callee, following import aliases. */
function calleeSymbolDeclarations(call: Node): Node[] {
  const expr = (call as any).getExpression?.() as Node | undefined;
  if (!expr) return [];

  let nameNode: Node = expr;
  if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    nameNode = expr.asKind(SyntaxKind.PropertyAccessExpression)!.getNameNode();
  } else if (expr.getKind() !== SyntaxKind.Identifier) {
    // element access, calls on call results, etc. — not statically nameable here.
    return [];
  }

  try {
    let symbol = nameNode.getSymbol();
    if (!symbol) return [];

    // Follow the alias chain (import specifiers / re-exports) to the real declaration.
    const declarations: Node[] = [];
    const seen = new Set<unknown>();
    while (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      declarations.push(...symbol.getDeclarations());
      symbol = symbol.getAliasedSymbol();
    }
    return declarations;
  } catch {
    return [];
  }
}

export interface CallGraphResult {
  graph: FunctionGraph;
  skippedDynamicCalls: number;
}

/** Build the function-level call graph across all analyzed files. */
export function buildCallGraph(ctx: ProjectContext): CallGraphResult {
  const nodes: FunctionNode[] = [];
  const declToId = new Map<Node, string>();
  const sourceFiles: SourceFile[] = [];

  for (const sf of ctx.project.getSourceFiles()) {
    const rel = ctx.fileKeyToRel.get(fsKey(sf.getFilePath()));
    if (!rel) continue;
    sourceFiles.push(sf);
    collectFunctions(sf, rel, nodes, declToId);
  }

  const edgeSet = new Set<string>();
  const edges: FunctionEdge[] = [];
  let skippedDynamicCalls = 0;

  for (const sf of sourceFiles) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      // Identify the enclosing function (source of the call).
      const enclosing = call.getFirstAncestor((a) => declToId.has(a));
      if (!enclosing) continue; // top-level call, not attributed to a function
      const sourceId = declToId.get(enclosing)!;

      // Identify the called function (target).
      const decls = calleeSymbolDeclarations(call);
      let targetId: string | undefined;
      for (const decl of decls) {
        const found = declToId.get(decl);
        if (found) {
          targetId = found;
          break;
        }
      }

      if (!targetId) {
        skippedDynamicCalls++;
        continue;
      }
      if (targetId === sourceId) continue; // skip self-recursion

      const key = `${sourceId}->${targetId}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({ source: sourceId, target: targetId, kind: "call" });
    }
  }

  return { graph: { nodes, edges }, skippedDynamicCalls };
}
