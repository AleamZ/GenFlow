import path from "node:path";

/** Convert any path to posix-style forward slashes. */
export function toPosix(p: string): string {
  return p.split(path.sep).join("/").replace(/\\/g, "/");
}

/**
 * A filesystem-comparison key for an absolute path.
 * On Windows the filesystem is case-insensitive, so we lowercase to compare reliably.
 */
export function fsKey(absPath: string): string {
  const norm = toPosix(path.resolve(absPath));
  return process.platform === "win32" ? norm.toLowerCase() : norm;
}

/** Relative posix path from root to target. */
export function relFromRoot(root: string, absPath: string): string {
  return toPosix(path.relative(root, absPath));
}

/** Posix directory of a relative path, or "." for root-level files. */
export function posixDirname(relPath: string): string {
  const dir = path.posix.dirname(relPath);
  return dir === "" ? "." : dir;
}

/** Basename of a path. */
export function basename(p: string): string {
  return path.posix.basename(toPosix(p));
}
