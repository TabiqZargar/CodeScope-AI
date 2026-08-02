/**
 * Aurora Graphite — the centralized design token system.
 *
 * Every color in the application resolves to one of these semantic tokens.
 * Components must never hardcode colors. Tailwind utilities (bg-canvas,
 * text-ink-primary, border-line, bg-primary, …) map 1:1 to these values via
 * the `@theme` block in src/app/globals.css; runtime canvases that need raw
 * colors (Monaco theme, React Flow canvas, SVGs) import the values from here.
 *
 * Keep the hex values in globals.css `@theme` in sync with this file.
 */

export const tokens = {
  background: {
    /** Page backdrop. */
    primary: "#080A0F",
    /** Section wells / secondary wells. */
    secondary: "#0C1018",
    /** Raised wells (inspector, dialogs). */
    elevated: "#171C25",
    /** Hairline overlay washes. */
    overlay: "rgba(255,255,255,0.03)",
  },
  surface: {
    /** Primary panel surface. */
    default: "#11141B",
    /** Elevated panel surface (cards inside panels). */
    elevated: "#181D27",
    /** Translucent glass fill for layered panels. */
    glass: "rgba(255,255,255,0.04)",
    /** Hover fill. */
    hover: "rgba(255,255,255,0.06)",
  },
  border: {
    /** Default hairline. */
    default: "rgba(255,255,255,0.06)",
    /** Active / selected border. */
    active: "rgba(117,104,255,0.45)",
  },
  text: {
    /** Primary content. */
    primary: "#F4F7FB",
    /** Secondary content. */
    secondary: "#B2BAC8",
    /** Muted content. */
    muted: "#7F8797",
    /** Disabled content. */
    disabled: "#5B6472",
  },
  /** Brand primary (indigo). */
  primary: "#7568FF",
  /** Brand secondary (cyan). */
  secondary: "#4FD8FF",
  accent: {
    /** AI / explainer surfaces. */
    ai: "#A855F7",
    /** Heap / reference / return surfaces. */
    heap: "#34D399",
    /** Functions / calls. */
    functions: "#FB923C",
    /** Loops / warnings / bookmarks. */
    loops: "#FACC15",
    /** Conditions / branches. */
    conditions: "#F472B6",
    /** Console output. */
    console: "#38BDF8",
  },
  status: {
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
} as const;

export type Tokens = typeof tokens;

/** Raw colors consumed by runtime canvases (Monaco, React Flow). */
export const runtime = {
  editor: {
    background: tokens.background.primary,
    foreground: tokens.text.primary,
    comment: "#5C6A7D",
    keyword: tokens.accent.ai,
    string: tokens.accent.heap,
    number: tokens.accent.loops,
    type: tokens.accent.console,
    variable: tokens.text.primary,
    operator: tokens.accent.console,
    delimiter: tokens.text.disabled,
    identifier: tokens.text.primary,
    lineNumber: "#3A4354",
    lineNumberActive: tokens.text.muted,
    cursor: tokens.secondary,
    selection: `${tokens.secondary}44`,
  },
} as const;

/** React Flow canvas palette. */
export const graphColors = {
  edgeOffPath: "rgba(255,255,255,0.08)",
  edgeOffPathMarker: "rgba(255,255,255,0.16)",
  edgeLabel: "#52525B",
  edgeLabelBg: "#181D27",
  nodeFill: "rgba(255,255,255,0.03)",
  nodeFillPath: "rgba(117,104,255,0.08)",
  nodeFillCurrent: "rgba(117,104,255,0.16)",
  nodeStroke: "rgba(117,104,255,0.4)",
  nodeText: tokens.text.primary,
  nodeTextMuted: tokens.text.disabled,
  nodeTextPath: tokens.text.secondary,
  backgroundDot: "rgba(255,255,255,0.06)",
  minimapMask: "rgba(0,0,0,0.65)",
} as const;

/** Per-snapshot-type accent colors (timeline nodes, graph nodes). */
export const typeColors = {
  declaration: tokens.primary,
  assignment: tokens.secondary,
  condition: tokens.accent.conditions,
  loop: tokens.accent.loops,
  call: tokens.accent.functions,
  return: tokens.accent.heap,
  console: tokens.accent.console,
  other: tokens.text.disabled,
  error: tokens.status.danger,
} as const;
