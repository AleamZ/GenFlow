import { Search, X } from "lucide-react";
import { useGraphStore } from "../store/useGraphStore";

export function SearchBar() {
  const search = useGraphStore((s) => s.search);
  const setSearch = useGraphStore((s) => s.setSearch);

  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search file…"
        className="w-56 rounded-md border border-edge bg-panel py-1.5 pl-8 pr-7 text-sm text-ink outline-none placeholder:text-muted focus:border-sky-500"
      />
      {search && (
        <button
          onClick={() => setSearch("")}
          className="absolute right-2 top-2 text-muted hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
