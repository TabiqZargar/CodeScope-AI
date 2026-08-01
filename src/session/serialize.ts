import type {
  AiSettingsData,
  BreakpointData,
  EditorSettings,
  Session,
  SessionContent,
  SessionMeta,
  ThemeSettings,
} from "./types";

/**
 * Deterministic serialization.
 *
 * Sessions serialize to stable JSON: keys always appear in a fixed order, and
 * unordered collections (breakpoints, bookmarks) are sorted before encoding.
 * The output of `serializeSession` is therefore byte-identical for
 * structurally identical sessions, which is what makes auto-save diffing,
 * cache keys and share-link deduplication safe. No random ids are ever
 * emitted.
 */

function canonicalBreakpoints(breakpoints: readonly BreakpointData[]): BreakpointData[] {
  return [...breakpoints]
    .map((b) => ({ line: b.line, enabled: b.enabled }))
    .sort((a, b) => a.line - b.line);
}

function canonicalAi(ai: AiSettingsData): AiSettingsData {
  return {
    provider: ai.provider,
    model: ai.model,
    temperature: ai.temperature,
    stream: ai.stream,
    cacheEnabled: ai.cacheEnabled,
  };
}

function canonicalTheme(theme: ThemeSettings): ThemeSettings {
  return {
    theme: theme.theme,
    reducedMotion: theme.reducedMotion,
    density: theme.density,
  };
}

function canonicalEditor(editor: EditorSettings): EditorSettings {
  return {
    fontSize: editor.fontSize,
    tabSize: editor.tabSize,
    wordWrap: editor.wordWrap,
    minimap: editor.minimap,
    lineNumbers: editor.lineNumbers,
  };
}

function canonicalMeta(meta: SessionMeta): SessionMeta {
  return { app: meta.app, createdAt: meta.createdAt, modifiedAt: meta.modifiedAt };
}

/** Canonical content object: fixed key order, sorted collections. */
export function canonicalContent(content: SessionContent): SessionContent {
  return {
    code: content.code,
    snapshotIndex: content.snapshotIndex,
    breakpoints: canonicalBreakpoints(content.breakpoints),
    watches: [...content.watches],
    view: content.view,
    playbackSpeed: content.playbackSpeed,
    isPlaying: content.isPlaying,
    bookmarks: [...content.bookmarks].sort((a, b) => a - b),
    showMiniMap: content.showMiniMap,
    ai: canonicalAi(content.ai),
    theme: canonicalTheme(content.theme),
    editor: canonicalEditor(content.editor),
  };
}

/** Canonical session object: `schemaVersion`, `meta`, `content`, in that order. */
export function canonicalSession(session: Session): Session {
  return {
    schemaVersion: session.schemaVersion,
    meta: canonicalMeta(session.meta),
    content: canonicalContent(session.content),
  };
}

/** Deterministic compact JSON for a session. */
export function serializeSession(session: Session): string {
  return JSON.stringify(canonicalSession(session));
}

/** Deterministic pretty JSON (for exports that humans may open). */
export function serializeSessionPretty(session: Session): string {
  return JSON.stringify(canonicalSession(session), null, 2);
}

/**
 * Signature of a session's *content* — used to detect changes cheaply.
 * Content-only so that editing (code/index/etc.) is the only trigger, and so
 * two saves with only a timestamp difference share a signature.
 */
export function sessionContentSignature(content: SessionContent): string {
  return JSON.stringify(canonicalContent(content));
}

/** Default (empty-ish) content, used for a fresh workspace. */
export function defaultSessionContent(code: string): SessionContent {
  return {
    code,
    snapshotIndex: 0,
    breakpoints: [],
    watches: [],
    view: "timeline",
    playbackSpeed: 1,
    isPlaying: false,
    bookmarks: [],
    showMiniMap: false,
    ai: {
      provider: "mock",
      model: "codescope-mock",
      temperature: 0.2,
      stream: true,
      cacheEnabled: true,
    },
    theme: { theme: "dark", reducedMotion: false, density: "comfortable" },
    editor: {
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      minimap: false,
      lineNumbers: true,
    },
  };
}
