import { app, BrowserWindow, ipcMain, dialog, protocol } from "electron";
import path from "node:path";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { watch as chokidarWatch, type FSWatcher } from "chokidar";
import { fsKey } from "../../../analyzer/src/lib";
import type { GraphJSON } from "../../../analyzer/src/lib";

// ES modules (Vite output) won't load over file://, so serve the renderer through
// a privileged custom protocol that sets correct MIME types.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const RENDERER_MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

let win: BrowserWindow | null = null;
let worker: Worker | null = null;
let watcher: FSWatcher | null = null;

let reqCounter = 0;
const pending = new Map<number, { resolve: (g: GraphJSON) => void; reject: (e: Error) => void }>();

let debounce: NodeJS.Timeout | null = null;
const changedBatch = new Set<string>();

const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "out",
  ".next",
  ".nuxt",
  ".turbo",
  ".git",
]);

/** Ignore predicate evaluated only on the path RELATIVE to the watched root, so a
 *  dot-prefixed parent dir (e.g. ~/.config/proj) doesn't cause everything to be ignored. */
function makeIgnore(root: string): (p: string) => boolean {
  const rootResolved = path.resolve(root);
  return (p: string) => {
    const rel = path.relative(rootResolved, path.resolve(p));
    if (!rel || rel.startsWith("..")) return false;
    return rel
      .split(/[/\\]/)
      .some((seg) => seg.startsWith(".") || IGNORE_DIRS.has(seg));
  };
}

function sendStatus(state: "analyzing" | "idle" | "error", message?: string): void {
  win?.webContents.send("genflow:status", { state, message });
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(path.join(__dirname, "worker.cjs"));
  worker.on("message", (msg: { type: string; reqId: number; graph?: GraphJSON; message?: string }) => {
    if (msg.type === "graph" && msg.graph) {
      const p = pending.get(msg.reqId);
      if (p) {
        p.resolve(msg.graph);
        pending.delete(msg.reqId);
      } else {
        // No pending request → this is a live watch update; push to renderer.
        win?.webContents.send("genflow:graphUpdate", msg.graph);
      }
      sendStatus("idle");
    } else if (msg.type === "error") {
      const p = pending.get(msg.reqId);
      if (p) {
        p.reject(new Error(msg.message));
        pending.delete(msg.reqId);
      }
      sendStatus("error", msg.message);
    }
  });
  worker.on("error", (e) => sendStatus("error", String(e)));
  return worker;
}

function callWorker(cmd: "init" | "refresh", payload: Record<string, unknown>): Promise<GraphJSON> {
  const w = ensureWorker();
  const reqId = ++reqCounter;
  return new Promise((resolve, reject) => {
    pending.set(reqId, { resolve, reject });
    w.postMessage({ cmd, reqId, ...payload });
  });
}

async function resetWorker(): Promise<void> {
  stopWatch();
  if (worker) {
    await worker.terminate();
    worker = null;
  }
  pending.clear();
}

function triggerRefresh(): void {
  const changed = [...changedBatch];
  changedBatch.clear();
  sendStatus("analyzing");
  // reqId 0 → no pending entry → result is pushed to the renderer as a live update.
  ensureWorker().postMessage({ cmd: "refresh", reqId: 0, changed });
}

function startWatch(root: string): void {
  stopWatch();
  watcher = chokidarWatch(root, {
    ignoreInitial: true,
    persistent: true,
    ignored: makeIgnore(root),
  });
  const onEvent = (p: string) => {
    if (!SOURCE_RE.test(p)) return;
    changedBatch.add(p);
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(triggerRefresh, 400);
  };
  watcher.on("add", onEvent).on("change", onEvent).on("unlink", onEvent);
}

function stopWatch(): void {
  if (watcher) {
    void watcher.close();
    watcher = null;
  }
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  changedBatch.clear();
}

// ---- IPC ----

ipcMain.handle("genflow:openFolder", async () => {
  if (!win) return null;
  const res = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
    title: "Select a project to analyze",
  });
  return res.canceled || !res.filePaths[0] ? null : res.filePaths[0];
});

ipcMain.handle(
  "genflow:analyze",
  async (_e, root: string, opts?: { functions?: boolean; includeTests?: boolean }) => {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      throw new Error(`Not a directory: ${root}`);
    }
    await resetWorker();
    sendStatus("analyzing");
    return callWorker("init", {
      options: {
        root,
        includeFunctions: opts?.functions !== false,
        includeTests: !!opts?.includeTests,
      },
    });
  },
);

ipcMain.handle("genflow:startWatch", async (_e, root: string) => startWatch(root));
ipcMain.handle("genflow:stopWatch", async () => stopWatch());

ipcMain.handle("genflow:readFile", async (_e, root: string, filePath: string) => {
  const rootKey = fsKey(root);
  const fileK = fsKey(filePath);
  if (fileK !== rootKey && !fileK.startsWith(rootKey + "/")) {
    throw new Error("Path escapes project root");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error("File not found");
  }
  if (fs.statSync(filePath).size > 1024 * 1024) {
    throw new Error("File too large to preview");
  }
  return fs.readFileSync(filePath, "utf8");
});

// ---- Window ----

function createWindow(): void {
  const shotMode = !!process.env.GENFLOW_SHOT;
  win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: "#0b0e16",
    title: "GenFlow",
    autoHideMenuBar: true,
    show: !shotMode,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Offscreen rendering lets us capture a real frame in a headless/CI environment.
      offscreen: shotMode,
    },
  });
  win.loadURL("app://local/index.html");

  if (shotMode) {
    setupScreenshot(win);
  }
}

const RENDERER_DIR = path.join(__dirname, "../dist-renderer");

function registerAppProtocol(): void {
  protocol.handle("app", async (request) => {
    const { pathname } = new URL(request.url);
    const rel = pathname === "/" || pathname === "" ? "/index.html" : pathname;
    const filePath = path.join(RENDERER_DIR, decodeURIComponent(rel));
    // Guard against escaping the renderer directory.
    if (!filePath.startsWith(RENDERER_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      const data = await readFile(filePath);
      const mime = RENDERER_MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
      return new Response(data, { headers: { "content-type": mime } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function setupScreenshot(window: BrowserWindow): void {
  let latest: Electron.NativeImage | null = null;
  window.webContents.on("paint", (_e, _dirty, image) => {
    latest = image;
  });
  window.webContents.on("console-message", (_e, _lvl, message) => console.log("[renderer]", message));
  window.webContents.on("did-fail-load", (_e, code, desc) => console.error("did-fail-load", code, desc));

  window.webContents.on("did-finish-load", async () => {
    const folder = process.env.GENFLOW_SHOT_PATH;
    if (folder) {
      try {
        sendStatus("analyzing");
        const graph = await callWorker("init", {
          options: { root: folder, includeFunctions: true, includeTests: false },
        });
        window.webContents.send("genflow:graphUpdate", graph);
      } catch (e) {
        console.error("screenshot analyze failed", e);
      }
    }
    setTimeout(() => {
      if (latest) {
        fs.writeFileSync(process.env.GENFLOW_SHOT!, latest.toPNG());
        console.log("screenshot saved", JSON.stringify(latest.getSize()));
      } else {
        console.error("no paint frame captured");
      }
      app.quit();
    }, Number(process.env.GENFLOW_SHOT_DELAY ?? 9000));
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("before-quit", () => {
  stopWatch();
  void worker?.terminate();
});
