import { Plus, Trash2 } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";
import { TYPE_ORDER, TYPE_STYLES } from "../theme";
import type { NodeType, Rule } from "../types";

function newRule(): Rule {
  return {
    id: crypto.randomUUID(),
    name: "Rule",
    pattern: "",
    enabled: true,
    setType: undefined,
    setGroup: undefined,
    setColor: undefined,
  };
}

export function RulesPanel() {
  const rules = useGraphStore((s) => s.rules);
  const addRule = useGraphStore((s) => s.addRule);
  const updateRule = useGraphStore((s) => s.updateRule);
  const removeRule = useGraphStore((s) => s.removeRule);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted">
        Define your own logic: if a file path matches a regex, override its type / group / color.
        Saved to your browser.
      </p>

      {rules.map((r) => (
        <div key={r.id} className="space-y-1.5 rounded-md border border-edge/70 bg-panel p-2">
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) => updateRule(r.id, { enabled: e.target.checked })}
              className="accent-sky-500"
            />
            <input
              value={r.pattern}
              onChange={(e) => updateRule(r.id, { pattern: e.target.value })}
              placeholder="regex e.g. ^src/services/"
              className="flex-1 rounded border border-edge bg-panel2 px-1.5 py-1 font-mono text-xs text-ink outline-none focus:border-sky-500"
            />
            <button
              onClick={() => removeRule(r.id)}
              className="text-muted hover:text-rose-400"
              title="Delete rule"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={r.setType ?? ""}
              onChange={(e) =>
                updateRule(r.id, { setType: (e.target.value || undefined) as NodeType | undefined })
              }
              className="rounded border border-edge bg-panel2 px-1 py-1 text-xs text-ink outline-none"
            >
              <option value="">type: keep</option>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  → {TYPE_STYLES[t].label}
                </option>
              ))}
            </select>
            <input
              value={r.setGroup ?? ""}
              onChange={(e) => updateRule(r.id, { setGroup: e.target.value || undefined })}
              placeholder="group: keep"
              className="rounded border border-edge bg-panel2 px-1.5 py-1 text-xs text-ink outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Color:</span>
            <input
              type="color"
              value={r.setColor ?? "#38bdf8"}
              onChange={(e) => updateRule(r.id, { setColor: e.target.value })}
              className="h-5 w-8 cursor-pointer rounded border border-edge bg-transparent"
            />
            {r.setColor && (
              <button
                onClick={() => updateRule(r.id, { setColor: undefined })}
                className="text-[11px] text-muted hover:text-ink"
              >
                clear
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={() => addRule(newRule())}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-edge py-1.5 text-xs text-muted hover:border-sky-500 hover:text-ink"
      >
        <Plus size={13} /> Add rule
      </button>
    </div>
  );
}
