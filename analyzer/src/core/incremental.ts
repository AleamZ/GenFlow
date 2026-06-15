import { scanProject } from "./scan.js";
import { createProjectContext, syncProjectFiles, type ProjectContext } from "./project.js";
import { buildGraphFromContext } from "./buildGraph.js";
import type { AnalyzeOptions, GraphJSON } from "../types.js";

/**
 * Holds a persistent ts-morph project for one root so repeated analyses (while
 * watching for file changes) reuse the parse cache instead of re-reading every file.
 */
export class IncrementalAnalyzer {
  private ctx: ProjectContext;

  constructor(private readonly options: AnalyzeOptions) {
    const files = scanProject(options.root, options);
    this.ctx = createProjectContext(options.root, files);
  }

  get root(): string {
    return this.options.root;
  }

  /** Full analysis using the current project state. */
  analyze(): GraphJSON {
    return buildGraphFromContext(this.ctx, this.options);
  }

  /**
   * Re-scan, sync changed/added/removed files into the existing project, and
   * re-analyze. Pass the absolute paths that changed (from the file watcher) so
   * only those are reloaded from disk.
   */
  refresh(changedAbsPaths: string[] = []): GraphJSON {
    const files = scanProject(this.options.root, this.options);
    syncProjectFiles(this.ctx, files, changedAbsPaths);
    return buildGraphFromContext(this.ctx, this.options);
  }
}
