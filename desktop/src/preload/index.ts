import { contextBridge, ipcRenderer } from "electron";

type Cb = (...args: unknown[]) => void;
const graphListeners = new Set<Cb>();
const statusListeners = new Set<Cb>();

ipcRenderer.on("genflow:graphUpdate", (_e, graph) => graphListeners.forEach((cb) => cb(graph)));
ipcRenderer.on("genflow:status", (_e, status) => statusListeners.forEach((cb) => cb(status)));

contextBridge.exposeInMainWorld("genflow", {
  version: __APP_VERSION__,
  openFolder: () => ipcRenderer.invoke("genflow:openFolder"),
  analyze: (path: string, opts?: unknown) => ipcRenderer.invoke("genflow:analyze", path, opts),
  readFile: (root: string, path: string) => ipcRenderer.invoke("genflow:readFile", root, path),
  startWatch: (path: string) => ipcRenderer.invoke("genflow:startWatch", path),
  stopWatch: () => ipcRenderer.invoke("genflow:stopWatch"),
  onGraphUpdate: (cb: Cb) => {
    graphListeners.add(cb);
    return () => graphListeners.delete(cb);
  },
  onStatus: (cb: Cb) => {
    statusListeners.add(cb);
    return () => statusListeners.delete(cb);
  },
});

declare const __APP_VERSION__: string;
