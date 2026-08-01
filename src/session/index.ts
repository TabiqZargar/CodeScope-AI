/**
 * CodeScope session system.
 *
 * A pure, dependency-free layer (no interpreter, debugger, AI, or React) that
 * owns the user's complete workspace: deterministic serialization, schema
 * versioning + migrations, validation, compression, share URLs, file import/
 * export, and local auto-save. The UI translates its own state into
 * {@link SessionContent} and back via the exported APIs.
 *
 * Cloud storage is not implemented here; {@link CloudSessionProvider} is the
 * seam future providers implement without changing the session format.
 */

export { APP_ID, SCHEMA_VERSION } from "./types";
export type {
  AiSettingsData,
  BreakpointData,
  EditorSettings,
  Session,
  SessionContent,
  SessionError,
  SessionErrorCode,
  SessionMeta,
  SessionResult,
  SessionView,
  ThemeSettings,
} from "./types";

export {
  canonicalContent,
  canonicalSession,
  defaultSessionContent,
  serializeSession,
  serializeSessionPretty,
  sessionContentSignature,
} from "./serialize";

export {
  buildSession,
  deserializeSession,
  emptySession,
} from "./deserialize";

export {
  hasMigration,
  migrateSession,
  migrationVersions,
  registerMigration,
  setMigration,
} from "./migration";

export {
  SESSION_LIMITS,
  isEditorSettings,
  isThemeSettings,
  validateContent,
  validateSession,
} from "./validation";

export {
  clearCompressionCache,
  compressSession,
  compressText,
  decompressSession,
  decompressText,
  isShareEncoded,
} from "./compress";

export {
  MAX_SHARE_LINK_LENGTH,
  SHARE_PARAM,
  buildShareLink,
  defaultShareBase,
  getCloudProvider,
  hasSharePayload,
  listCloudProviders,
  readSharePayload,
  registerCloudProvider,
  shareSessionFromEncoded,
  shareSessionFromUrl,
  shareUrlPreview,
  stripShareParam,
} from "./share";
export type { CloudSessionProvider, ShareLinkResult } from "./share";

export {
  AUTOSAVE_KEY,
  clearStoredSession,
  createMemoryStorage,
  defaultStorage,
  hasStoredSession,
  loadStoredSession,
  storeSession,
} from "./storage";
export type { StorageLike } from "./storage";
