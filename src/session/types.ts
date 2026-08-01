/**
 * Session model for CodeScope AI.
 *
 * A Session is the complete user workspace, expressed as plain, serializable
 * data. The session layer is deliberately independent of the interpreter, the
 * debugger, the AI layer, and React: it only moves structured data in and out
 * of JSON, compressed strings, storage and URLs. The UI translates its own
 * state into {@link SessionContent} and back.
 *
 * Privacy rules baked into the model:
 *   - API keys are never stored.
 *   - AI responses and cached explanations are never stored.
 *   - Temporary runtime state (snapshots, heap, console) is never stored —
 *     the code is re-executed on restore and only the *index* is remembered.
 *
 * Schema versioning: every session carries `schemaVersion`. New shapes are
 * handled by the migration registry (see `migration.ts`), never by breaking
 * old files.
 */

/** Identifier of the application that produces sessions. */
export const APP_ID = "codescope";

/** Current session schema version. Bump + add a migration when the shape changes. */
export const SCHEMA_VERSION = 1;

/** The two render views the debugger exposes. */
export type SessionView = "timeline" | "graph";

/** A breakpoint as stored in a session: source line + enabled flag. */
export interface BreakpointData {
  readonly line: number;
  readonly enabled: boolean;
}

/** AI settings persisted with a session (never keys, never responses). */
export interface AiSettingsData {
  readonly provider: string;
  readonly model: string;
  readonly temperature: number;
  readonly stream: boolean;
  readonly cacheEnabled: boolean;
}

/** Theme / UI preferences. */
export interface ThemeSettings {
  readonly theme: "dark" | "light";
  readonly reducedMotion: boolean;
  readonly density: "comfortable" | "compact";
}

/** Editor preferences. */
export interface EditorSettings {
  readonly fontSize: number;
  readonly tabSize: number;
  readonly wordWrap: boolean;
  readonly minimap: boolean;
  readonly lineNumbers: boolean;
}

/** Everything the visualizer restores from a session. */
export interface SessionContent {
  /** The source code (never the runtime state it produced). */
  readonly code: string;
  /** The selected snapshot index; clamped on restore. */
  readonly snapshotIndex: number;
  /** Breakpoints as line → enabled. */
  readonly breakpoints: readonly BreakpointData[];
  /** Watch expressions, in display order. */
  readonly watches: readonly string[];
  /** Timeline vs Graph view. */
  readonly view: SessionView;
  /** Playback speed multiplier (1 = normal). */
  readonly playbackSpeed: number;
  /** Playback state at save time. */
  readonly isPlaying: boolean;
  /** Bookmarked snapshot indices. */
  readonly bookmarks: readonly number[];
  /** Whether the mini map was visible. */
  readonly showMiniMap: boolean;
  /** AI provider settings (non-secret only). */
  readonly ai: AiSettingsData;
  /** Theme / UI preferences. */
  readonly theme: ThemeSettings;
  /** Editor preferences. */
  readonly editor: EditorSettings;
}

/** Session metadata: provenance + timestamps. */
export interface SessionMeta {
  /** Always {@link APP_ID}; guards against importing another app's file. */
  readonly app: string;
  /** Epoch ms when the workspace was first created. */
  readonly createdAt: number;
  /** Epoch ms of the last modification. */
  readonly modifiedAt: number;
}

/** The complete session document. */
export interface Session {
  readonly schemaVersion: number;
  readonly meta: SessionMeta;
  readonly content: SessionContent;
}

/** Machine-readable reason a session was rejected. */
export type SessionErrorCode =
  | "not-object"
  | "missing-schema-version"
  | "invalid-schema-version"
  | "unsupported-version"
  | "invalid-meta"
  | "invalid-code"
  | "code-too-long"
  | "invalid-snapshot-index"
  | "invalid-breakpoints"
  | "too-many-breakpoints"
  | "invalid-watches"
  | "too-many-watches"
  | "invalid-view"
  | "invalid-playback-speed"
  | "invalid-bookmarks"
  | "too-many-bookmarks"
  | "invalid-minimap"
  | "invalid-ai-settings"
  | "invalid-theme"
  | "invalid-editor";

/** A structured rejection. `message` is safe to show to users. */
export interface SessionError {
  readonly code: SessionErrorCode;
  readonly message: string;
}

/** Result of any attempt to build a {@link Session} from untrusted input. */
export type SessionResult =
  | { readonly ok: true; readonly session: Session }
  | { readonly ok: false; readonly error: SessionError };
