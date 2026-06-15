import fg from "fast-glob";
import path from "node:path";
import { relFromRoot } from "./paths.js";

export const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.cache/**",
  "**/out/**",
  "**/.turbo/**",
  "**/*.min.js",
  "**/*.bundle.js",
  "**/*-lock.*",
  "**/*.lock",
];

export const TEST_IGNORES = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/*.stories.*",
];

export const SOURCE_EXTENSIONS = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];

export interface ScannedFile {
  absPath: string;
  relPath: string;
}

export interface ScanOptions {
  includeTests: boolean;
  extraIgnores: string[];
}

/** Walk the project root, returning source files to analyze (ignores excluded). */
export function scanProject(root: string, opts: ScanOptions): ScannedFile[] {
  const ignore = [...DEFAULT_IGNORES, ...opts.extraIgnores];
  if (!opts.includeTests) ignore.push(...TEST_IGNORES);

  const pattern = `**/*.{${SOURCE_EXTENSIONS.join(",")}}`;
  const entries = fg.sync(pattern, {
    cwd: root,
    ignore,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    suppressErrors: true,
  });

  return entries
    .map((absPath) => ({
      absPath: path.resolve(absPath),
      relPath: relFromRoot(root, absPath),
    }))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
}
