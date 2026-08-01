import { APP_ID, SCHEMA_VERSION } from "./types";
import type {
  EditorSettings,
  Session,
  SessionContent,
  SessionErrorCode,
  SessionResult,
  SessionView,
  ThemeSettings,
} from "./types";

/**
 * Validation.
 *
 * Every untrusted session (imported file, share URL, stored copy) passes
 * through here. Validation is strict about structure and limits but never
 * throws: malformed input becomes a structured {@link SessionResult} with a
 * user-safe message. Limits are generous enough for real programs while
 * bounding the resources a hostile session can claim.
 */

export const SESSION_LIMITS = {
  /** Max source length in characters. */
  maxCodeLength: 200_000,
  /** Max watch expressions. */
  maxWatches: 100,
  /** Max breakpoints. */
  maxBreakpoints: 500,
  /** Max bookmarks. */
  maxBookmarks: 1_000,
  /** Sanity bound for snapshot indices (clamped on restore anyway). */
  maxSnapshotIndex: 1_000_000,
  /** Max length of a single watch expression. */
  maxWatchLength: 500,
  /** Max provider / model identifier length. */
  maxNameLength: 200,
} as const;

const VIEWS: ReadonlySet<string> = new Set<SessionView>(["timeline", "graph"]);
const THEMES: ReadonlySet<string> = new Set(["dark", "light"]);
const DENSITIES: ReadonlySet<string> = new Set(["comfortable", "compact"]);

function fail(code: SessionErrorCode, message: string): SessionResult {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** Validate a fully-migrated, defaulted session object. Never throws. */
export function validateSession(input: unknown): SessionResult {
  if (!isRecord(input)) return fail("not-object", "A session must be a JSON object.");

  const { schemaVersion, meta, content } = input;

  if (schemaVersion === undefined) {
    return fail("missing-schema-version", "The session is missing its schema version.");
  }
  if (!isFiniteNumber(schemaVersion)) {
    return fail("invalid-schema-version", "The session schema version must be a number.");
  }
  if (schemaVersion !== SCHEMA_VERSION) {
    return fail("unsupported-version", `This session uses schema v${schemaVersion}; only v${SCHEMA_VERSION} is supported.`);
  }

  if (!isRecord(meta)) return fail("invalid-meta", "The session metadata is invalid.");
  if (meta.app !== APP_ID) return fail("invalid-meta", "This file was not created by CodeScope.");
  if (!isFiniteNumber(meta.createdAt)) return fail("invalid-meta", "The creation timestamp is invalid.");
  if (!isFiniteNumber(meta.modifiedAt)) return fail("invalid-meta", "The modification timestamp is invalid.");

  if (!isRecord(content)) return fail("invalid-code", "The session content is invalid.");

  if (!isString(content.code)) return fail("invalid-code", "The session code must be a string.");
  if (content.code.length > SESSION_LIMITS.maxCodeLength) {
    return fail("code-too-long", `Code is too long (max ${SESSION_LIMITS.maxCodeLength} characters).`);
  }

  if (!isNonNegativeInteger(content.snapshotIndex)) {
    return fail("invalid-snapshot-index", "The snapshot index must be a non-negative integer.");
  }
  if (content.snapshotIndex > SESSION_LIMITS.maxSnapshotIndex) {
    return fail("invalid-snapshot-index", "The snapshot index is out of range.");
  }

  // Breakpoints
  if (!Array.isArray(content.breakpoints)) {
    return fail("invalid-breakpoints", "Breakpoints must be a list.");
  }
  if (content.breakpoints.length > SESSION_LIMITS.maxBreakpoints) {
    return fail("too-many-breakpoints", `Too many breakpoints (max ${SESSION_LIMITS.maxBreakpoints}).`);
  }
  for (const bp of content.breakpoints) {
    if (!isRecord(bp) || !isNonNegativeInteger(bp.line) || bp.line === 0 || !isBoolean(bp.enabled)) {
      return fail("invalid-breakpoints", "Each breakpoint needs a line number and an enabled flag.");
    }
  }

  // Watches
  if (!Array.isArray(content.watches)) return fail("invalid-watches", "Watches must be a list.");
  if (content.watches.length > SESSION_LIMITS.maxWatches) {
    return fail("too-many-watches", `Too many watches (max ${SESSION_LIMITS.maxWatches}).`);
  }
  for (const watch of content.watches) {
    if (!isString(watch) || watch.length > SESSION_LIMITS.maxWatchLength) {
      return fail("invalid-watches", "Each watch must be a short string.");
    }
  }

  // View
  if (!isString(content.view) || !VIEWS.has(content.view)) {
    return fail("invalid-view", "The view must be 'timeline' or 'graph'.");
  }

  // Playback speed
  if (!isFiniteNumber(content.playbackSpeed) || content.playbackSpeed <= 0) {
    return fail("invalid-playback-speed", "Playback speed must be a positive number.");
  }

  // Bookmarks
  if (!Array.isArray(content.bookmarks)) return fail("invalid-bookmarks", "Bookmarks must be a list.");
  if (content.bookmarks.length > SESSION_LIMITS.maxBookmarks) {
    return fail("too-many-bookmarks", `Too many bookmarks (max ${SESSION_LIMITS.maxBookmarks}).`);
  }
  for (const bookmark of content.bookmarks) {
    if (!isNonNegativeInteger(bookmark)) return fail("invalid-bookmarks", "Each bookmark must be a snapshot index.");
  }

  if (!isBoolean(content.showMiniMap)) return fail("invalid-minimap", "The mini map flag must be a boolean.");

  // AI settings (never secrets — validate shape only)
  const ai = content.ai;
  if (!isRecord(ai)) return fail("invalid-ai-settings", "AI settings are invalid.");
  if (!isString(ai.provider) || ai.provider.length > SESSION_LIMITS.maxNameLength) {
    return fail("invalid-ai-settings", "The AI provider must be a short string.");
  }
  if (!isString(ai.model) || ai.model.length > SESSION_LIMITS.maxNameLength) {
    return fail("invalid-ai-settings", "The AI model must be a short string.");
  }
  if (!isFiniteNumber(ai.temperature) || ai.temperature < 0 || ai.temperature > 1) {
    return fail("invalid-ai-settings", "The AI temperature must be between 0 and 1.");
  }
  if (!isBoolean(ai.stream) || !isBoolean(ai.cacheEnabled)) {
    return fail("invalid-ai-settings", "AI streaming and caching flags must be booleans.");
  }

  // Theme / UI preferences
  const theme = content.theme;
  if (!isRecord(theme)) return fail("invalid-theme", "Theme preferences are invalid.");
  if (!isString(theme.theme) || !THEMES.has(theme.theme)) return fail("invalid-theme", "The theme must be 'dark' or 'light'.");
  if (!isBoolean(theme.reducedMotion)) return fail("invalid-theme", "The reduced-motion flag must be a boolean.");
  if (!isString(theme.density) || !DENSITIES.has(theme.density)) return fail("invalid-theme", "The layout density is invalid.");

  // Editor settings
  const editor = content.editor;
  if (!isRecord(editor)) return fail("invalid-editor", "Editor preferences are invalid.");
  if (!isFiniteNumber(editor.fontSize) || editor.fontSize <= 0 || editor.fontSize > 64) {
    return fail("invalid-editor", "The editor font size is invalid.");
  }
  if (!isNonNegativeInteger(editor.tabSize) || editor.tabSize === 0 || editor.tabSize > 16) {
    return fail("invalid-editor", "The editor tab size is invalid.");
  }
  for (const key of ["wordWrap", "minimap", "lineNumbers"] as const) {
    if (!isBoolean(editor[key])) return fail("invalid-editor", "Editor boolean preferences are invalid.");
  }

  return { ok: true, session: input as unknown as Session };
}

/** Validate the content shape only (used before building a session). */
export function validateContent(content: unknown): content is SessionContent {
  return isRecord(content) && isString(content.code) && content.code.length <= SESSION_LIMITS.maxCodeLength;
}

/** Type guards re-exported for UI code that translates session ↔ app state. */
export const isThemeSettings = (value: unknown): value is ThemeSettings =>
  isRecord(value) && (value.theme === "dark" || value.theme === "light");
export const isEditorSettings = (value: unknown): value is EditorSettings =>
  isRecord(value) && isFiniteNumber(value.fontSize);
