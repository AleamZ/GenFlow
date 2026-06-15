# Code Dependency Visualizer (GenFlow) — Design Spec

Date: 2026-06-15
Status: Approved — implementation in progress

## Goal
A local-first web app that reads a JS/TS project, analyzes file/module/function
dependencies via a real AST parser (ts-morph), and renders an interactive
force-directed graph (drag, zoom, click-to-inspect, search, filter, custom rules)
so a developer can understand and manage the architecture at a glance.

## Decisions (locked)
- **Input modes:** local path *and* zip upload (both in v1).
- **Graph depth:** file-level graph *and* function-level call graph (both in v1).
- **Analyzer engine:** ts-morph (self-built resolution + metrics + issues).
- **Custom rules:** regex/path rule form (assign type/color/group), persisted to localStorage.
- **Graph UX:** Hướng A — file graph always; function call graph stored separately
  (`functions` branch) and shown via a File ↔ Function view toggle, scoped to the
  selected file / active filter to stay performant.

## Architecture (monorepo, npm workspaces)
```
GenFlow/
├─ package.json          # workspaces + scripts: dev / analyze / build / test
├─ analyzer/             # Node + TypeScript: core engine + CLI + Fastify server
├─ web/                  # React + TS + Vite + Tailwind (dark theme) graph UI
├─ sample-project/       # demo repo containing a deliberate circular dependency
└─ docs/
```
- **One command:** `npm run dev` → analyzer server (watch) + Vite dev, browser auto-opens
  pointed at `sample-project/` so a graph shows on first run.
- **CLI:** `npm run analyze -- <path> -o graph.json [--functions] [--include-tests]`.
- Canonical JSON schema defined in `analyzer/src/types.ts`; `web/src/types.ts` mirrors it
  (pure types, no runtime coupling).

## Analyzer pipeline
`scan → project(ts-morph) → fileGraph → callGraph → classify → metrics → issues → buildGraph`

- **scan:** walk dir; ignore `node_modules, dist, build, .git, coverage, *.lock`;
  optionally ignore tests (`*.test.*`, `*.spec.*`, `__tests__`).
- **fileGraph:** imports/requires/exports → file edges. Resolve relative paths,
  tsconfig `paths` aliases, index files, implicit extensions (`.ts/.tsx/.js/.jsx/.mjs/.cjs`).
  Unresolvable/bare imports → `external` node.
- **callGraph (ts-morph):** function/method/arrow declarations + call expressions →
  `call` edges between `file#fn`. Best-effort static resolution; dynamic/computed calls
  are skipped and counted (no fabricated edges).
- **classify:** heuristics on path/name →
  `entrypoint / service / component / hook / util / store / config / external / module`.
- **metrics:** `fanIn` (distinct importers), `fanOut` (distinct internal imports),
  `loc` (non-blank lines), `externalDeps`.
- **issues:** circular via **Tarjan SCC** (ordered cycle paths); `orphans`
  (fanIn 0 and not an entrypoint); `godFiles` (fanIn/fanOut over threshold, default
  fanIn ≥ 10 or fanOut ≥ 15, configurable).

## JSON schema
```jsonc
{
  "version": "1.0", "root": "...", "meta": { "fileCount": 312, "edgeCount": 540 },
  "nodes": [{ "id": "src/bot.ts", "label": "bot.ts", "type": "service",
              "group": "src", "loc": 240, "fanIn": 3, "fanOut": 5,
              "level": "file", "isExternal": false }],
  "edges": [{ "source": "src/bot.ts", "target": "src/services/binance.ts", "kind": "import" }],
  "functions": {
    "nodes": [{ "id": "src/bot.ts#startBot", "file": "src/bot.ts", "label": "startBot",
                "line": 12, "loc": 30, "exported": true, "level": "function" }],
    "edges": [{ "source": "src/bot.ts#startBot", "target": "src/services/binance.ts#getPrice", "kind": "call" }]
  },
  "issues": { "circular": [["a.ts","b.ts","a.ts"]], "orphans": ["x.ts"],
              "godFiles": [{ "id": "src/util.ts", "fanIn": 22, "fanOut": 0 }] }
}
```

## Server (Fastify) + CLI
- `GET /api/graph?path=<abs>&functions=true&includeTests=false` → analyze, cached by path+mtime hash.
- `POST /api/upload` (zip multipart) → unzip to temp, analyze, return graph + token; cleanup later.
- `GET /api/file?root=&path=` → file source for code preview (path-traversal guarded; root-scoped).
- `GET /api/health`.
- CLI shares the same core (no server needed for offline use).

## Frontend (React + TS + Vite + Tailwind, dark)
- **GraphCanvas** (`react-force-graph-2d`): circle nodes sized ∝ √fanIn; drag/zoom/pan; color by type.
- **Hover** → highlight node + direct neighbors, dim the rest.
- **Click** → SidePanel: path, type, imports / imported-by lists, code preview, "Open file" (`vscode://` + copy).
- **SearchBar** → focus & zoom to node. **Legend** for type colors.
- **FilterPanel:** by folder/feature, by type, hide external, hide `fanIn < N`.
- **Cluster by folder** toggle (force clustering) for large repos.
- **IssuesPanel:** circular list; nodes in a cycle rendered red.
- **Toolbar:** File ↔ Function view toggle, cluster toggle, Export PNG / SVG / JSON.
- **RulesPanel:** add `regex path → assign type/color/group` rules, applied live, persisted to localStorage.
- State via **zustand**; filters/rules applied client-side (no re-analysis).

## Performance & quality
- ~300 files render smoothly on react-force-graph-2d (canvas). Function view is scoped to
  selected file / active filter to avoid drawing thousands of function nodes. `cooldownTicks`,
  clustering, and min-fanIn reduce load.
- **Tests (TDD):** analyzer uses **vitest** with fixture mini-projects (circular a↔b, alias
  `paths`, index resolution, external import, function call). The "detect ≥1 circular"
  acceptance has a real test. Frontend: a few component tests + manual run verification.
- README with install & run instructions.

## Build order (incremental, show after each step)
1. Analyzer → correct JSON + green tests → review JSON & graph of `sample-project`.
2. Frontend basic force-directed graph.
3. Interactions / filter / rules.
4. Function view + export + UI polish.

## Acceptance criteria
- Point at a real JS/TS project → correct graph; edges match real imports.
- Full interactivity: drag, zoom, click-to-inspect, search, filter.
- Detects ≥ 1 circular dependency when present.
- Stable on ~300-file repos without obvious lag (clustering when dense).
- Clean code + README.
