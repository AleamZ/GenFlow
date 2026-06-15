import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { IncrementalAnalyzer } from "../src/core/incremental.js";
import { DEFAULT_ANALYZE_OPTIONS } from "../src/types.js";

function tmpProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "genflow-inc-"));
}

function write(dir: string, rel: string, content: string): string {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

describe("IncrementalAnalyzer (realtime refresh)", () => {
  it("reflects added, changed, and removed files on refresh", () => {
    const dir = tmpProject();
    write(dir, "a.ts", `import { b } from "./b";\nexport const x = b();\n`);
    write(dir, "b.ts", `export function b() { return 1; }\n`);

    const analyzer = new IncrementalAnalyzer({
      ...DEFAULT_ANALYZE_OPTIONS,
      root: dir,
      includeFunctions: false,
    });

    // Initial state.
    let g = analyzer.analyze();
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a.ts", "b.ts"]);
    expect(g.edges.some((e) => e.source === "a.ts" && e.target === "b.ts")).toBe(true);

    // Add c.ts and make a.ts import it → new node + new edge appear.
    const cPath = write(dir, "c.ts", `export const c = 42;\n`);
    const aPath = write(
      dir,
      "a.ts",
      `import { b } from "./b";\nimport { c } from "./c";\nexport const x = b() + c;\n`,
    );
    g = analyzer.refresh([cPath, aPath]);
    expect(g.nodes.map((n) => n.id)).toContain("c.ts");
    expect(g.edges.some((e) => e.source === "a.ts" && e.target === "c.ts")).toBe(true);
    const cNode = g.nodes.find((n) => n.id === "c.ts")!;
    expect(cNode.fanIn).toBe(1);

    // Remove c.ts and its import → node + edge disappear.
    fs.rmSync(cPath);
    write(dir, "a.ts", `import { b } from "./b";\nexport const x = b();\n`);
    g = analyzer.refresh([aPath, cPath]);
    expect(g.nodes.map((n) => n.id)).not.toContain("c.ts");
    expect(g.edges.some((e) => e.target === "c.ts")).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("introduces a circular dependency live", () => {
    const dir = tmpProject();
    write(dir, "x.ts", `import { y } from "./y";\nexport const x = () => y;\n`);
    write(dir, "y.ts", `export const y = 1;\n`);

    const analyzer = new IncrementalAnalyzer({
      ...DEFAULT_ANALYZE_OPTIONS,
      root: dir,
      includeFunctions: false,
    });
    expect(analyzer.analyze().issues.circular.length).toBe(0);

    // Make y import x → cycle.
    const yPath = write(dir, "y.ts", `import { x } from "./x";\nexport const y = x;\n`);
    const g = analyzer.refresh([yPath]);
    expect(g.issues.circular.length).toBeGreaterThanOrEqual(1);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
