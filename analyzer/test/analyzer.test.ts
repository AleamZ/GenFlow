import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "../src/core/buildGraph.js";
import { DEFAULT_ANALYZE_OPTIONS, type AnalyzeOptions, type GraphJSON } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(here, "fixtures", name);
const sampleProject = path.resolve(here, "../../sample-project");

function analyze(root: string, overrides: Partial<AnalyzeOptions> = {}): GraphJSON {
  return analyzeProject({ root, ...DEFAULT_ANALYZE_OPTIONS, ...overrides });
}

function hasEdge(g: GraphJSON, source: string, target: string): boolean {
  return g.edges.some((e) => e.source === source && e.target === target);
}

describe("file graph", () => {
  it("resolves relative imports into internal edges", () => {
    const g = analyze(fixture("cyclic"));
    expect(hasEdge(g, "a.ts", "b.ts")).toBe(true);
    expect(hasEdge(g, "b.ts", "a.ts")).toBe(true);
    expect(hasEdge(g, "c.ts", "a.ts")).toBe(true);
  });

  it("computes fan-in / fan-out", () => {
    const g = analyze(fixture("cyclic"));
    const a = g.nodes.find((n) => n.id === "a.ts")!;
    expect(a.fanIn).toBe(2); // imported by b and c
    expect(a.fanOut).toBe(1); // imports b
  });

  it("resolves tsconfig path aliases to internal files", () => {
    const g = analyze(fixture("alias"));
    expect(hasEdge(g, "src/index.ts", "src/utils/helper.ts")).toBe(true);
    expect(g.nodes.filter((n) => n.isExternal)).toHaveLength(0);
  });

  it("treats bare/unresolved specifiers as external packages", () => {
    const g = analyze(fixture("externals"));
    const ext = g.nodes.filter((n) => n.isExternal).map((n) => n.id);
    expect(ext).toContain("ext:definitely-missing-pkg");
    expect(ext).toContain("ext:@acme/widgets"); // scoped package name preserved
    expect(hasEdge(g, "index.ts", "local.ts")).toBe(true);
  });
});

describe("issues", () => {
  it("detects a circular dependency", () => {
    const g = analyze(fixture("cyclic"));
    expect(g.issues.circular.length).toBeGreaterThanOrEqual(1);
    const flat = g.issues.circular.flat();
    expect(flat).toContain("a.ts");
    expect(flat).toContain("b.ts");
    // c.ts is not part of the cycle (it only imports a, nothing imports it)
    const cycle = g.issues.circular[0];
    expect(cycle[0]).toBe(cycle[cycle.length - 1]); // closed loop
  });

  it("flags orphan modules with no edges", () => {
    const g = analyze(fixture("orphan"));
    expect(g.issues.orphans).toContain("lonely.ts");
  });
});

describe("call graph", () => {
  it("builds cross-file function call edges", () => {
    const g = analyze(fixture("calls"));
    const fnIds = g.functions.nodes.map((n) => n.id);
    expect(fnIds).toContain("main.ts#compute");
    expect(fnIds).toContain("math.ts#add");
    expect(
      g.functions.edges.some(
        (e) => e.source === "main.ts#compute" && e.target === "math.ts#add",
      ),
    ).toBe(true);
  });

  it("can be disabled", () => {
    const g = analyze(fixture("calls"), { includeFunctions: false });
    expect(g.functions.nodes).toHaveLength(0);
    expect(g.functions.edges).toHaveLength(0);
  });
});

describe("sample project (end-to-end acceptance)", () => {
  const g = analyze(sampleProject);

  it("analyzes all source files", () => {
    expect(g.meta.fileCount).toBeGreaterThanOrEqual(8);
    expect(g.meta.languages).toContain("ts");
  });

  it("detects the bot <-> binance circular dependency", () => {
    expect(g.issues.circular.length).toBeGreaterThanOrEqual(1);
    const flat = g.issues.circular.flat();
    expect(flat).toContain("src/bot.ts");
    expect(flat).toContain("src/services/binance.ts");
  });

  it("resolves alias imports (@/utils/logger) to internal files", () => {
    expect(hasEdge(g, "src/bot.ts", "src/utils/logger.ts")).toBe(true);
  });

  it("captures external packages", () => {
    const ext = g.nodes.filter((n) => n.isExternal).map((n) => n.id);
    expect(ext).toContain("ext:axios");
    expect(ext).toContain("ext:node-telegram-bot-api");
  });

  it("detects the entrypoint from package.json main", () => {
    const idx = g.nodes.find((n) => n.id === "src/index.ts")!;
    expect(idx.type).toBe("entrypoint");
  });

  it("flags the orphan module", () => {
    expect(g.issues.orphans).toContain("src/utils/unused.ts");
  });

  it("builds a function call edge across files (handleMessage -> getPrice)", () => {
    expect(
      g.functions.edges.some(
        (e) =>
          e.source === "src/bot.ts#handleMessage" &&
          e.target === "src/services/binance.ts#getPrice",
      ),
    ).toBe(true);
  });
});
