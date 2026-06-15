// Programmatic entry point for embedding the analyzer (e.g. the Electron app).
export * from "./types.js";
export { analyzeProject, buildGraphFromContext } from "./core/buildGraph.js";
export { IncrementalAnalyzer } from "./core/incremental.js";
export { scanProject, DEFAULT_IGNORES, TEST_IGNORES } from "./core/scan.js";
export { fsKey, toPosix } from "./core/paths.js";
