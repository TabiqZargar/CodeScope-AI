import { defaultSessionContent } from "./serialize";
import { migrateSession } from "./migration";
import { APP_ID, SCHEMA_VERSION } from "./types";
import type { Session, SessionContent, SessionErrorCode, SessionMeta, SessionResult } from "./types";
import { isEditorSettings, isThemeSettings, SESSION_LIMITS } from "./validation";

/**
 * Deserialization.
 *
 * Turns untrusted input (file text, share payload, stored copy) into a valid
 * {@link Session}. The pipeline is: parse → migrate → default missing optional
 * fields → validate. Deserialization never throws and never trusts its input.
 */

/** Defaults for fields that may be absent in older/foreign sessions. */
const DEFAULT_AI = {
  provider: "mock",
  model: "codescope-mock",
  temperature: 0.2,
  stream: true,
  cacheEnabled: true,
};

const DEFAULT_THEME = { theme: "dark" as const, reducedMotion: false, density: "comfortable" as const };

const DEFAULT_EDITOR = { fontSize: 14, tabSize: 2, wordWrap: true, minimap: false, lineNumbers: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: SessionErrorCode, message: string): SessionResult {
  return { ok: false, error: { code, message } };
}

/** Clamp a single watch to the allowed length (defense in depth). */
function clampString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Apply defaults for every optional field so a minimal session like
 * `{ schemaVersion: 1, meta: {...}, content: { code: "..." } }` loads cleanly.
 */
function applyDefaults(raw: Record<string, unknown>): Record<string, unknown> {
  const content = isRecord(raw.content) ? raw.content : {};
  const meta = isRecord(raw.meta) ? raw.meta : {};

  const breakpoints = Array.isArray(content.breakpoints)
    ? content.breakpoints
        .filter((bp): bp is Record<string, unknown> => isRecord(bp))
        .filter((bp) => typeof bp.line === "number" && typeof bp.enabled === "boolean")
        .slice(0, SESSION_LIMITS.maxBreakpoints)
        .map((bp) => ({ line: bp.line as number, enabled: bp.enabled as boolean }))
    : [];

  const watches = Array.isArray(content.watches)
    ? content.watches
        .map((watch) => clampString(watch, SESSION_LIMITS.maxWatchLength))
        .filter((watch) => watch.length > 0)
        .slice(0, SESSION_LIMITS.maxWatches)
    : [];

  const bookmarks = Array.isArray(content.bookmarks)
    ? content.bookmarks
        .filter((b): b is number => typeof b === "number" && Number.isInteger(b) && b >= 0)
        .slice(0, SESSION_LIMITS.maxBookmarks)
        .map((b) => b)
    : [];

  const ai = isRecord(content.ai) ? content.ai : {};
  const theme = isRecord(content.theme) ? content.theme : {};
  const editor = isRecord(content.editor) ? content.editor : {};

  const view = content.view === "graph" ? "graph" : "timeline";
  const playbackSpeed =
    typeof content.playbackSpeed === "number" && Number.isFinite(content.playbackSpeed) && content.playbackSpeed > 0
      ? content.playbackSpeed
      : 1;
  const snapshotIndex =
    typeof content.snapshotIndex === "number" && Number.isInteger(content.snapshotIndex) && content.snapshotIndex >= 0
      ? Math.min(content.snapshotIndex, SESSION_LIMITS.maxSnapshotIndex)
      : 0;
  const code =
    typeof content.code === "string" ? content.code.slice(0, SESSION_LIMITS.maxCodeLength) : "";

  return {
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    meta: {
      app: typeof meta.app === "string" && meta.app ? meta.app : APP_ID,
      createdAt: typeof meta.createdAt === "number" ? meta.createdAt : Date.now(),
      modifiedAt: typeof meta.modifiedAt === "number" ? meta.modifiedAt : Date.now(),
    },
    content: {
      code,
      snapshotIndex,
      breakpoints,
      watches,
      view,
      playbackSpeed,
      isPlaying: typeof content.isPlaying === "boolean" ? content.isPlaying : false,
      bookmarks,
      showMiniMap: typeof content.showMiniMap === "boolean" ? content.showMiniMap : false,
      ai: {
        provider: clampString(ai.provider, SESSION_LIMITS.maxNameLength) || DEFAULT_AI.provider,
        model: clampString(ai.model, SESSION_LIMITS.maxNameLength) || DEFAULT_AI.model,
        temperature:
          typeof ai.temperature === "number" && Number.isFinite(ai.temperature)
            ? Math.min(Math.max(ai.temperature, 0), 1)
            : DEFAULT_AI.temperature,
        stream: typeof ai.stream === "boolean" ? ai.stream : DEFAULT_AI.stream,
        cacheEnabled: typeof ai.cacheEnabled === "boolean" ? ai.cacheEnabled : DEFAULT_AI.cacheEnabled,
      },
      theme: isThemeSettings(theme)
        ? { ...DEFAULT_THEME, ...theme }
        : DEFAULT_THEME,
      editor: isEditorSettings(editor)
        ? {
            ...DEFAULT_EDITOR,
            ...editor,
            fontSize:
              typeof editor.fontSize === "number" && editor.fontSize > 0
                ? Math.min(editor.fontSize, 64)
                : DEFAULT_EDITOR.fontSize,
          }
        : DEFAULT_EDITOR,
    },
  };
}

/**
 * Deserialize a session from an already-parsed JSON value (or raw text).
 * Migrates, defaults, validates — and never throws.
 */
export function deserializeSession(input: unknown): SessionResult {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return fail("not-object", "This is not valid JSON.");
    }
  }
  if (!isRecord(value)) return fail("not-object", "A session must be a JSON object.");

  // Default first, then migrate, then validate.
  const defaulted = applyDefaults(value);
  return migrateSession(defaulted);
}

/** Build a fresh, valid session from content + timestamps (for saving). */
export function buildSession(content: SessionContent, createdAt: number, modifiedAt: number): Session {
  const meta: SessionMeta = { app: APP_ID, createdAt, modifiedAt };
  return { schemaVersion: SCHEMA_VERSION, meta, content };
}

/** A session whose content is the given code (fresh workspace). */
export function emptySession(code: string, now = Date.now()): Session {
  return buildSession(defaultSessionContent(code), now, now);
}
