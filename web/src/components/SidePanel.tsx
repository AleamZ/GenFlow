import { useEffect, useState } from "react";
import { X, ExternalLink, Copy, FileCode, ArrowRight, ArrowLeft, Network } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";
import { fetchFile } from "../api";
import { TYPE_STYLES } from "../theme";
import { Pill } from "./ui";
import type { FileNode, FunctionNode } from "../types";

function baseName(id: string): string {
  return id.split("/").pop() ?? id;
}

export function SidePanel() {
  const graph = useGraphStore((s) => s.graph);
  const selectedId = useGraphStore((s) => s.selectedId);
  const sourceRoot = useGraphStore((s) => s.sourceRoot);
  const setSelected = useGraphStore((s) => s.setSelected);
  const setViewMode = useGraphStore((s) => s.setViewMode);
  const setFunctionScopeFile = useGraphStore((s) => s.setFunctionScopeFile);

  const [code, setCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const fileNode = graph?.nodes.find((n) => n.id === selectedId) as FileNode | undefined;
  const fnNode = !fileNode
    ? (graph?.functions.nodes.find((n) => n.id === selectedId) as FunctionNode | undefined)
    : undefined;

  const previewPath = fileNode?.path ?? (fnNode && graph?.nodes.find((n) => n.id === fnNode.file)?.path);

  useEffect(() => {
    setCode(null);
    setCodeError(null);
    if (!previewPath || !sourceRoot) return;
    let cancelled = false;
    fetchFile(sourceRoot, previewPath)
      .then((c) => !cancelled && setCode(c))
      .catch((e) => !cancelled && setCodeError(e.message));
    return () => {
      cancelled = true;
    };
  }, [previewPath, sourceRoot]);

  if (!graph || !selectedId || (!fileNode && !fnNode)) return null;

  return (
    <aside className="flex h-full w-96 flex-col border-l border-edge bg-panel">
      <Header onClose={() => setSelected(null)}>
        {fileNode ? baseName(fileNode.id) : fnNode!.label}
      </Header>

      <div className="flex-1 overflow-y-auto">
        {fileNode && <FileDetails node={fileNode} />}
        {fnNode && <FunctionDetails node={fnNode} />}

        {/* Code preview */}
        <div className="border-t border-edge/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <FileCode size={13} /> Code preview
            </span>
            {fileNode && !fileNode.isExternal && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setViewMode("function");
                    setFunctionScopeFile(fileNode.id);
                  }}
                  className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300"
                  title="Show this file's functions"
                >
                  <Network size={12} /> functions
                </button>
                {fileNode.path && (
                  <>
                    <button
                      onClick={() => navigator.clipboard?.writeText(fileNode.path!)}
                      className="text-muted hover:text-ink"
                      title="Copy path"
                    >
                      <Copy size={13} />
                    </button>
                    <a
                      href={`vscode://file/${fileNode.path}`}
                      className="text-muted hover:text-ink"
                      title="Open in VS Code"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
          {fileNode?.isExternal ? (
            <p className="text-xs text-muted">External package — no source to preview.</p>
          ) : codeError ? (
            <p className="text-xs text-rose-400">{codeError}</p>
          ) : code === null ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : (
            <pre className="max-h-80 overflow-auto rounded bg-[#0b0e16] p-2 text-[11px] leading-relaxed text-slate-300">
              <code>{code.split("\n").slice(0, 400).join("\n")}</code>
            </pre>
          )}
        </div>
      </div>
    </aside>
  );
}

function Header({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-edge px-3 py-2.5">
      <h2 className="truncate font-mono text-sm font-semibold text-ink" title={String(children)}>
        {children}
      </h2>
      <button onClick={onClose} className="text-muted hover:text-ink">
        <X size={16} />
      </button>
    </div>
  );
}

function FileDetails({ node }: { node: FileNode }) {
  const graph = useGraphStore((s) => s.graph)!;
  const setSelected = useGraphStore((s) => s.setSelected);

  const outgoing = graph.edges.filter((e) => e.source === node.id);
  const incoming = graph.edges.filter((e) => e.target === node.id);
  const style = TYPE_STYLES[node.type];

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
          style={{ background: `${style.color}22`, color: style.color }}
        >
          {style.label}
        </span>
        <Pill>LOC {node.loc}</Pill>
        <Pill>fan-in {node.fanIn}</Pill>
        <Pill>fan-out {node.fanOut}</Pill>
        {node.externalDeps > 0 && <Pill>ext {node.externalDeps}</Pill>}
      </div>
      <p className="break-all font-mono text-[11px] text-muted">{node.id}</p>

      <RefList
        title="Imports"
        icon={<ArrowRight size={12} />}
        items={outgoing.map((e) => ({ id: e.target, kind: e.kind }))}
        onPick={setSelected}
      />
      <RefList
        title="Imported by"
        icon={<ArrowLeft size={12} />}
        items={incoming.map((e) => ({ id: e.source, kind: e.kind }))}
        onPick={setSelected}
      />
    </div>
  );
}

function FunctionDetails({ node }: { node: FunctionNode }) {
  const graph = useGraphStore((s) => s.graph)!;
  const setSelected = useGraphStore((s) => s.setSelected);
  const calls = graph.functions.edges.filter((e) => e.source === node.id);
  const calledBy = graph.functions.edges.filter((e) => e.target === node.id);
  const label = (id: string) => id.split("#").pop() ?? id;

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
          function
        </span>
        {node.exported && <Pill>exported</Pill>}
        <Pill>LOC {node.loc}</Pill>
        <Pill>line {node.line}</Pill>
      </div>
      <button
        onClick={() => setSelected(node.file)}
        className="break-all font-mono text-[11px] text-sky-400 hover:underline"
      >
        {node.file}
      </button>

      <RefList
        title="Calls"
        icon={<ArrowRight size={12} />}
        items={calls.map((e) => ({ id: e.target, label: label(e.target) }))}
        onPick={setSelected}
      />
      <RefList
        title="Called by"
        icon={<ArrowLeft size={12} />}
        items={calledBy.map((e) => ({ id: e.source, label: label(e.source) }))}
        onPick={setSelected}
      />
    </div>
  );
}

function RefList({
  title,
  icon,
  items,
  onPick,
}: {
  title: string;
  icon: React.ReactNode;
  items: { id: string; kind?: string; label?: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon} {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted">—</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((it, i) => (
            <li key={`${it.id}-${i}`}>
              <button
                onClick={() => onPick(it.id)}
                className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-panel2"
                title={it.id}
              >
                <span className="truncate font-mono text-ink/90">
                  {it.label ?? it.id.replace(/^ext:/, "")}
                </span>
                {it.kind && it.kind !== "import" && (
                  <span className="shrink-0 text-[10px] text-muted">{it.kind}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
