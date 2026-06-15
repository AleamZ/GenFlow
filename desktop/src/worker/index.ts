import { parentPort } from "node:worker_threads";
import { IncrementalAnalyzer, DEFAULT_ANALYZE_OPTIONS } from "../../../analyzer/src/lib";
import type { AnalyzeOptions } from "../../../analyzer/src/lib";

// Runs the ts-morph analyzer off the main thread so the UI stays responsive.
// Keeps one IncrementalAnalyzer warm so live re-analysis reuses the parse cache.

let analyzer: IncrementalAnalyzer | null = null;
const port = parentPort;
if (!port) throw new Error("worker must run as a worker thread");

interface InitMsg { cmd: "init"; reqId: number; options: Partial<AnalyzeOptions> & { root: string } }
interface RefreshMsg { cmd: "refresh"; reqId: number; changed: string[] }
type Msg = InitMsg | RefreshMsg;

port.on("message", (msg: Msg) => {
  try {
    if (msg.cmd === "init") {
      const options: AnalyzeOptions = { ...DEFAULT_ANALYZE_OPTIONS, ...msg.options };
      analyzer = new IncrementalAnalyzer(options);
      port.postMessage({ type: "graph", reqId: msg.reqId, graph: analyzer.analyze() });
    } else if (msg.cmd === "refresh") {
      if (!analyzer) return;
      port.postMessage({ type: "graph", reqId: msg.reqId, graph: analyzer.refresh(msg.changed ?? []) });
    }
  } catch (err) {
    port.postMessage({
      type: "error",
      reqId: msg.reqId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
