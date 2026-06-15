import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function Section({
  title,
  children,
  defaultOpen = true,
  right,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-edge/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted hover:text-ink"
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {title}
        </span>
        {right}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink/90">
      <span
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-7 rounded-full transition ${
          checked ? "bg-sky-500" : "bg-edge"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </label>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-panel2 px-1.5 py-0.5 text-[11px] tabular text-muted">{children}</span>
  );
}
