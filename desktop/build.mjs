import { build } from "esbuild";
import { readFileSync, cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const pkg = JSON.parse(readFileSync(path.join(here, "package.json"), "utf8"));

// The analyzer source uses ESM-style ".js" specifiers that map to ".ts" files
// (the standard TS pattern). esbuild doesn't do that mapping by default, so add it.
const tsResolvePlugin = {
  name: "ts-js-resolve",
  setup(b) {
    b.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.kind === "entry-point" || !args.path.startsWith(".")) return;
      const abs = path.resolve(args.resolveDir, args.path);
      const tsPath = abs.replace(/\.js$/, ".ts");
      if (existsSync(tsPath)) return { path: tsPath };
      return undefined;
    });
  },
};

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
  // electron is provided by the runtime; fsevents is an optional native dep of chokidar (mac).
  external: ["electron", "fsevents"],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [tsResolvePlugin],
  logLevel: "info",
};

mkdirSync(path.join(here, "dist-main"), { recursive: true });

await Promise.all([
  build({ ...common, entryPoints: [path.join(here, "src/main/index.ts")], outfile: path.join(here, "dist-main/index.cjs") }),
  build({ ...common, entryPoints: [path.join(here, "src/preload/index.ts")], outfile: path.join(here, "dist-main/preload.cjs") }),
  build({ ...common, entryPoints: [path.join(here, "src/worker/index.ts")], outfile: path.join(here, "dist-main/worker.cjs") }),
]);

// Copy the built web app to be loaded via file:// by the main process.
const webDist = path.resolve(repoRoot, "web/dist");
if (!existsSync(path.join(webDist, "index.html"))) {
  throw new Error("web/dist not found — run `npm run build -w @genflow/web` first.");
}
const rendererDest = path.join(here, "dist-renderer");
rmSync(rendererDest, { recursive: true, force: true });
cpSync(webDist, rendererDest, { recursive: true });

console.log("✓ desktop build complete (dist-main + dist-renderer)");
