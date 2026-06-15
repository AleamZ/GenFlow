import { useGraphStore } from "../store/useGraphStore";
import { TYPE_ORDER, TYPE_STYLES, CIRCULAR_COLOR } from "../theme";

export function Legend() {
  const hiddenTypes = useGraphStore((s) => s.filters.hiddenTypes);
  const toggleType = useGraphStore((s) => s.toggleType);

  return (
    <div className="space-y-1">
      <p className="mb-1 text-[11px] text-muted">Click a type to show/hide it.</p>
      {TYPE_ORDER.map((type) => {
        const style = TYPE_STYLES[type];
        const hidden = hiddenTypes.includes(type);
        return (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-panel2 ${
              hidden ? "opacity-35" : ""
            }`}
            title={style.description}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: style.color }}
            />
            <span className="flex-1">{style.label}</span>
            {hidden && <span className="text-[10px] text-muted">hidden</span>}
          </button>
        );
      })}
      <div className="mt-2 flex items-center gap-2 px-1.5 text-sm text-muted">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: CIRCULAR_COLOR }} />
        Circular dependency
      </div>
    </div>
  );
}
