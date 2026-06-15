import path from "node:path";
import fs from "node:fs";
import { Project, ts } from "ts-morph";
import type { ScannedFile } from "./scan.js";
import { fsKey } from "./paths.js";

export interface ProjectContext {
  project: Project;
  compilerOptions: ts.CompilerOptions;
  /** Map from a filesystem key (see fsKey) to the file's posix relPath. */
  fileKeyToRel: Map<string, string>;
  moduleResolutionCache: ts.ModuleResolutionCache;
  root: string;
}

function findTsConfig(root: string): string | undefined {
  const candidate = path.join(root, "tsconfig.json");
  return fs.existsSync(candidate) ? candidate : undefined;
}

/** Load and resolve compiler options from the project's tsconfig (or sensible defaults). */
export function loadCompilerOptions(root: string): ts.CompilerOptions {
  let options: ts.CompilerOptions = {};
  const tsConfigPath = findTsConfig(root);

  if (tsConfigPath) {
    const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (!configFile.error) {
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsConfigPath),
      );
      options = parsed.options;
    }
  }

  // Force resolution-friendly defaults so analysis works on loose JS projects too.
  options.allowJs = true;
  options.checkJs = false;
  options.noEmit = true;
  options.allowImportingTsExtensions = true;
  options.jsx ??= ts.JsxEmit.ReactJSX;
  options.moduleResolution ??= ts.ModuleResolutionKind.Bundler;
  options.module ??= ts.ModuleKind.ESNext;
  options.target ??= ts.ScriptTarget.ESNext;
  if (options.paths && !options.baseUrl) {
    options.baseUrl = root;
  }
  return options;
}

/** Create a ts-morph project loaded with the scanned files (no auto-add from tsconfig). */
export function createProjectContext(root: string, files: ScannedFile[]): ProjectContext {
  const compilerOptions = loadCompilerOptions(root);

  const project = new Project({
    compilerOptions,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    useInMemoryFileSystem: false,
  });

  const fileKeyToRel = new Map<string, string>();
  for (const f of files) {
    project.addSourceFileAtPathIfExists(f.absPath);
    fileKeyToRel.set(fsKey(f.absPath), f.relPath);
  }

  const moduleResolutionCache = ts.createModuleResolutionCache(
    root,
    (x) => x,
    compilerOptions,
  );

  return { project, compilerOptions, fileKeyToRel, moduleResolutionCache, root };
}

/**
 * Sync an existing project's source files to a fresh scan: remove deleted files,
 * add new ones, and reload changed ones from disk. Reuses the parse cache so
 * re-analysis while watching stays fast.
 */
export function syncProjectFiles(
  ctx: ProjectContext,
  files: ScannedFile[],
  changedAbsPaths: string[] = [],
): void {
  const newKeys = new Set(files.map((f) => fsKey(f.absPath)));
  const changedKeys = new Set(changedAbsPaths.map(fsKey));

  // Remove deleted files; refresh changed ones.
  for (const sf of [...ctx.project.getSourceFiles()]) {
    const key = fsKey(sf.getFilePath());
    if (!ctx.fileKeyToRel.has(key)) continue; // not one of our scanned files
    if (!newKeys.has(key)) {
      ctx.project.removeSourceFile(sf);
      ctx.fileKeyToRel.delete(key);
    } else if (changedKeys.has(key)) {
      sf.refreshFromFileSystemSync();
    }
  }

  // Add newly created files.
  for (const f of files) {
    const key = fsKey(f.absPath);
    if (!ctx.fileKeyToRel.has(key)) {
      const sf = ctx.project.addSourceFileAtPathIfExists(f.absPath);
      if (sf) ctx.fileKeyToRel.set(key, f.relPath);
    }
  }
}
