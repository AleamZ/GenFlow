import type { GraphJSON } from "./types";
import { bridge } from "./platform";

export interface GraphRequest {
  path?: string;
  functions?: boolean;
  includeTests?: boolean;
  refresh?: boolean;
}

async function asError(res: Response): Promise<never> {
  let message = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    /* ignore */
  }
  throw new Error(message);
}

/** Analyze a local directory (or the bundled sample when path is omitted). */
export async function fetchGraph(req: GraphRequest = {}): Promise<GraphJSON> {
  if (bridge) {
    if (!req.path) throw new Error("Chọn một thư mục để phân tích / Pick a folder to analyze.");
    return bridge.analyze(req.path, { functions: req.functions, includeTests: req.includeTests });
  }
  const params = new URLSearchParams();
  if (req.path) params.set("path", req.path);
  if (req.functions === false) params.set("functions", "false");
  if (req.includeTests) params.set("includeTests", "true");
  if (req.refresh) params.set("refresh", "1");
  const res = await fetch(`/api/graph?${params.toString()}`);
  if (!res.ok) return asError(res);
  return res.json();
}

/** Upload a zip archive for analysis. */
export async function uploadZip(file: File): Promise<GraphJSON> {
  if (bridge) {
    throw new Error("Trên app desktop hãy dùng “Open folder”. / Use “Open folder” in the desktop app.");
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) return asError(res);
  return res.json();
}

/** Fetch a single file's source for the code-preview panel. */
export async function fetchFile(root: string, path: string): Promise<string> {
  if (bridge) return bridge.readFile(root, path);
  const params = new URLSearchParams({ root, path });
  const res = await fetch(`/api/file?${params.toString()}`);
  if (!res.ok) return asError(res);
  const body = await res.json();
  return body.content as string;
}
