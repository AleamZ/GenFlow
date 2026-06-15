#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { analyzeProject } from "./core/buildGraph.js";
import { DEFAULT_ANALYZE_OPTIONS } from "./types.js";

const program = new Command();

program
  .name("genflow-analyze")
  .description("Analyze a JS/TS project and emit a dependency graph as JSON.")
  .argument("<path>", "path to the project directory to analyze")
  .option("-o, --output <file>", "write JSON to a file instead of stdout")
  .option("--no-functions", "skip the function-level call graph")
  .option("--include-tests", "include test/spec files", false)
  .option("--god-fan-in <n>", "fan-in threshold for god files", String(DEFAULT_ANALYZE_OPTIONS.godFileFanIn))
  .option("--god-fan-out <n>", "fan-out threshold for god files", String(DEFAULT_ANALYZE_OPTIONS.godFileFanOut))
  .option("--pretty", "pretty-print JSON", false)
  .action((targetPath: string, opts) => {
    const root = path.resolve(targetPath);
    const t0 = Date.now();

    const graph = analyzeProject({
      root,
      includeFunctions: opts.functions !== false,
      includeTests: Boolean(opts.includeTests),
      godFileFanIn: Number(opts.godFanIn),
      godFileFanOut: Number(opts.godFanOut),
      extraIgnores: [],
    });

    const json = JSON.stringify(graph, null, opts.pretty ? 2 : 0);

    if (opts.output) {
      fs.writeFileSync(opts.output, json, "utf8");
      const ms = Date.now() - t0;
      console.error(
        `✓ Analyzed ${graph.meta.fileCount} files, ${graph.meta.edgeCount} edges, ` +
          `${graph.meta.functionCount} functions in ${ms}ms`,
      );
      console.error(
        `  circular: ${graph.issues.circular.length}, orphans: ${graph.issues.orphans.length}, ` +
          `god files: ${graph.issues.godFiles.length}`,
      );
      console.error(`  → ${path.resolve(opts.output)}`);
    } else {
      process.stdout.write(json);
    }
  });

program.parseAsync().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
