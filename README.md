<p align="center">
  <img src="icon.svg" alt="CodeScope AI" width="96" height="96" />
</p>

<h1 align="center">CodeScope AI</h1>

<p align="center">
  Step-by-step JavaScript visualizer — watch variables, heap, call stack, and the
  execution graph change as your code runs, with AI explanations at every snapshot.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#ai-provider-configuration">AI Providers</a> ·
  <a href="#testing">Testing</a> ·
  <a href="#license">License</a>
</p>

---

## What it does

CodeScope AI executes JavaScript **in the browser** with a small hand-written
interpreter and turns every executed statement into an immutable snapshot. You
can then scrub forward and backward through that trace — without re-running —
and inspect exactly what changed, where control flowed, and why.

- **No `eval`, no `Function`, no VM.** A Babel parse feeds a safe interpreter
  that only supports a curated subset of JavaScript.
- **Everything runs locally.** Source, breakpoints, and UI state never leave
  the page. The only network calls are the ones you opt into for AI providers.

## Features

- **Immutable snapshot timeline** — one snapshot per executed statement, step
  forward or backward with no re-runs, plus a mini-map and timeline search.
- **Time-travel diffing** — every step marks the variables, heap entries, and
  call-stack frames that changed.
- **Inspector panels** — Variables, Heap, Call Stack, and a graphite terminal
  console, all live per snapshot.
- **Execution graph** — a navigable control-flow graph (conditionals, loop
  back-edges, call/return edges) with on-path highlighting and node filters.
- **Breakpoints & bookmarks** — pause playback on chosen lines; bookmark
  timeline nodes for reference.
- **Watch expressions** — track arbitrary expressions across the whole run.
- **AI explanations** — one-shot or streamed, per-snapshot explanations with
  confidence; works offline with the built-in local provider.
- **Example gallery** — curated, pre-verified programs with categories,
  difficulty levels, favorites, and recent history.
- **Sessions & sharing** — export a workspace as a compressed link or a
  `.codescope` file and restore it anywhere, with auto-save.
- **Aurora Graphite design system** — a centralized semantic token layer
  (`src/styles/tokens.ts` ⇄ `src/app/globals.css`) across the landing page and
  the playground.

## Getting Started

### Prerequisites

- Node.js 20+ and npm.

### Run the dev server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page links to
the playground; the docs live at `/docs`.

### Scripts

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `npm run dev`           | Start the Next.js dev server               |
| `npm run build`         | Production build                           |
| `npm run start`         | Serve the production build                 |
| `npm run lint`          | ESLint                                     |
| `npm run typecheck`     | TypeScript type checking (`tsc --noEmit`)  |
| `npm run test:engine`   | Engine/interpreter smoke tests             |
| `npm run test:debugger` | Debugger (diff, breakpoints, watch) tests  |
| `npm run test:graph`    | Execution-graph tests                      |
| `npm run test:pro-debugger` | Pro debugger (navigation, search, inspector) tests |
| `npm run test:ai`       | AI layer tests                             |
| `npm run test:session`  | Session serialize/restore tests            |
| `npm run test:examples` | Example gallery verification               |

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                               UI (React / Next.js)                          │
│  Editor (Monaco) · Timeline · Graph (React Flow) · Panels · AI Panel        │
└───────────────┬────────────────────────────────────────────────────────────┘
                │ read-only snapshots
┌───────────────▼────────────────────────────────────────────────────────────┐
│                          Debugger (src/debugger)                            │
│  diff · breakpoints · watch · search · navigation · snapshot-type · graph   │
└───────────────┬────────────────────────────────────────────────────────────┘
                │ immutable snapshot stream
┌───────────────▼────────────────────────────────────────────────────────────┐
│                     Engine (src/engine) — runs in the browser               │
│  Babel parser ──▶ interpreter ──▶ immutable snapshots                        │
└────────────────────────────────────────────────────────────────────────────┘
```

### Engine — `src/engine`

A Babel AST parse (`@babel/parser`) feeds a hand-written interpreter. Each
statement produces an immutable snapshot of scope bindings, heap objects,
call-stack frames, and console output. There is no `eval`, no `Function`
constructor, and no host access; unsupported constructs are rejected before
execution. Files: `parser.ts`, `interpreter.ts`, `evaluate.ts`, `environment.ts`,
`heap.ts`, `snapshot.ts`, `format.ts`, `types.ts`.

### Debugger — `src/debugger`

Pure functions over the snapshot stream: snapshot-type classification,
per-step diffs, breakpoint/continue logic, watch-expression evaluation,
timeline search, execution-graph construction and layout (`@dagrejs/dagre`),
and snapshot inspection.

### AI — `src/ai`

A transport seam over three providers — **mock** (deterministic, offline),
**OpenAI**, and **Google Gemini**. Providers implement one contract
(`complete` / `stream`), so streaming is negotiated automatically. Prompts are
built from minimal execution context (never full source); keys resolve
server-side and never reach the browser. See
[AI provider configuration](#ai-provider-configuration).

### Sessions — `src/session`

Serializes the whole workspace — code, breakpoints, watches, view, speed,
preferences — into a validated `Session` document, compresses it
(`lz-string`) into share links or `.codescope` files, and restores it with
schema validation and migration. Browser `localStorage` backs auto-save.

### UI — `src/components`, `src/hooks`

Feature components (`timeline/`, `graph/`, `gallery/`, `session/`,
`onboarding/`, `landing/`, `ui/`) compose with custom hooks
(`use-code-visualizer`, `use-timeline`, `use-ai-explain`, `use-session`,
`use-watches`) over the engine and debugger. The playground shell is
`src/components/code-scope-playground.tsx`.

### Design tokens — `src/styles/tokens.ts`

The Aurora Graphite system is the single source of truth for every color in
the app. Semantic maps (`tokens`, `runtime`, `graphColors`, `typeColors`)
mirror the `@theme` block in `src/app/globals.css`; Tailwind utilities
(`bg-canvas`, `text-ink-primary`, `border-line`, …) resolve to those tokens,
and runtime canvases (Monaco theme, React Flow) import the raw values.

## Supported JavaScript

A deliberate subset for teaching and visualization:

- `let` / `const` / `var` declarations, assignments, and re-assignment
- Primitives, objects, and arrays (including nested structures)
- Arithmetic, string, comparison, and logical operators
- `if` / `else`, `for`, `while` loops
- Function declarations and calls with parameters and return values
- `console.log` (captured per snapshot, not written to the real console)

Not supported: `eval`, `Function`, `class`, closures beyond what the
interpreter models, `async`/`await`, DOM/host APIs, and other side-effecting
constructs.

## AI provider configuration

The local provider is the default and needs nothing. To use a real model, set
the key on the server (e.g. `.env.local`) and pick the provider in the AI
settings dialog:

| Provider         | Env var           | Suggested models                    |
| ---------------- | ----------------- | ----------------------------------- |
| OpenAI           | `OPENAI_API_KEY`  | `gpt-4o-mini`, `gpt-4o`             |
| Google Gemini    | `GEMINI_API_KEY`  | `gemini-1.5-flash`, `gemini-2.0-flash` |

With no key configured, the app automatically falls back to the local
deterministic provider.

## Testing

The smoke suites run headless against the engine, debugger, graph, AI, session,
and example layers:

```bash
npm run test:engine
npm run test:debugger
npm run test:graph
npm run test:pro-debugger
npm run test:ai
npm run test:session
npm run test:examples
```

Run everything with the `build`/`lint`/`typecheck` gates before shipping:

```bash
npm run typecheck && npm run lint && npm run build
```

## Documentation

User documentation is bundled with the app at [`/docs`](src/app/docs/page.tsx),
covering the editor, timeline, inspector panels, execution graph, AI, the
example gallery, sessions, and privacy. The license is at
[`/license`](src/app/license/page.tsx).

## License

[MIT](https://github.com/TabiqZargar/CodeScope-AI) — see the in-app
[license page](src/app/license/page.tsx) for the full text.
