import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import AdmZip from "adm-zip";
import { analyzeProject } from "./core/buildGraph.js";
import { scanProject } from "./core/scan.js";
import { fsKey } from "./core/paths.js";
import { DEFAULT_ANALYZE_OPTIONS, type AnalyzeOptions, type GraphJSON } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PROJECT = path.resolve(here, "../../sample-project");
const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? "127.0.0.1";

/** Roots we are allowed to read files from (analyzed local dirs + uploaded zips). */
const allowedRoots = new Set<string>();

interface CacheEntry {
  signature: string;
  graph: GraphJSON;
}
const cache = new Map<string, CacheEntry>();

/** A cheap signature of a directory (file list + mtimes) for cache invalidation. */
function dirSignature(root: string, opts: Pick<AnalyzeOptions, "includeTests" | "extraIgnores">): string {
  const files = scanProject(root, opts);
  const hash = crypto.createHash("sha1");
  for (const f of files) {
    try {
      hash.update(`${f.relPath}:${fs.statSync(f.absPath).mtimeMs};`);
    } catch {
      hash.update(`${f.relPath}:0;`);
    }
  }
  return hash.digest("hex");
}

function buildOptions(root: string, query: Record<string, unknown>): AnalyzeOptions {
  return {
    root,
    includeFunctions: query.functions !== "false" && query.functions !== false,
    includeTests: query.includeTests === "true" || query.includeTests === true,
    godFileFanIn: query.godFanIn ? Number(query.godFanIn) : DEFAULT_ANALYZE_OPTIONS.godFileFanIn,
    godFileFanOut: query.godFanOut ? Number(query.godFanOut) : DEFAULT_ANALYZE_OPTIONS.godFileFanOut,
    extraIgnores: [],
  };
}

/** Analyze a root with caching keyed by options + directory signature. */
function analyzeCached(opts: AnalyzeOptions, force = false): GraphJSON {
  allowedRoots.add(fsKey(opts.root));
  const key = JSON.stringify({ ...opts, root: path.resolve(opts.root) });
  const signature = dirSignature(opts.root, opts);
  const cached = cache.get(key);
  if (!force && cached && cached.signature === signature) {
    return cached.graph;
  }
  const graph = analyzeProject(opts);
  cache.set(key, { signature, graph });
  return graph;
}

/** Ensure a requested file path is inside one of the allowed roots (no traversal). */
function assertReadable(root: string, filePath: string): string {
  const rootKey = fsKey(root);
  const fileKey = fsKey(filePath);
  if (!allowedRoots.has(rootKey)) {
    throw new Error("Root is not an analyzed project");
  }
  if (fileKey !== rootKey && !fileKey.startsWith(rootKey + "/")) {
    throw new Error("Path escapes project root");
  }
  return path.resolve(filePath);
}

async function main(): Promise<void> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } });

  app.get("/api/health", async () => ({ ok: true, sample: SAMPLE_PROJECT }));

  // Analyze a local directory (or the bundled sample when no path is given).
  app.get("/api/graph", async (req, reply) => {
    const query = req.query as Record<string, string>;
    const root = query.path ? path.resolve(query.path) : SAMPLE_PROJECT;
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      return reply.code(400).send({ error: `Not a directory: ${root}` });
    }
    try {
      const graph = analyzeCached(buildOptions(root, query), query.refresh === "1");
      return graph;
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Analyze an uploaded zip archive.
  app.post("/api/upload", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    const buffer = await data.toBuffer();
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), "genflow-"));
    try {
      new AdmZip(buffer).extractAllTo(dest, true);
    } catch (err) {
      return reply.code(400).send({ error: `Invalid zip: ${err instanceof Error ? err.message : err}` });
    }

    // If the archive has a single top-level folder, treat it as the project root.
    const entries = fs.readdirSync(dest, { withFileTypes: true });
    const root =
      entries.length === 1 && entries[0].isDirectory()
        ? path.join(dest, entries[0].name)
        : dest;

    try {
      const query = req.query as Record<string, string>;
      const graph = analyzeCached(buildOptions(root, query), true);
      return { ...graph, upload: { name: data.filename, root } };
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Read a single file's source for the code-preview panel.
  app.get("/api/file", async (req, reply) => {
    const query = req.query as Record<string, string>;
    if (!query.root || !query.path) {
      return reply.code(400).send({ error: "root and path are required" });
    }
    try {
      const resolved = assertReadable(query.root, query.path);
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return reply.code(404).send({ error: "File not found" });
      }
      const stat = fs.statSync(resolved);
      if (stat.size > 1024 * 1024) {
        return reply.code(413).send({ error: "File too large to preview" });
      }
      const content = fs.readFileSync(resolved, "utf8");
      return { path: query.path, content };
    } catch (err) {
      return reply.code(403).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  await app.listen({ port: PORT, host: HOST });
  // eslint-disable-next-line no-console
  console.log(`GenFlow analyzer API → http://${HOST}:${PORT}`);
  console.log(`Sample project: ${SAMPLE_PROJECT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
