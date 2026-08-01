import { compressSession, decompressSession, isShareEncoded } from "./compress";
import { serializeSession } from "./serialize";
import type { Session, SessionResult } from "./types";

/**
 * Share links + the future cloud seam.
 *
 * A share link is `baseUrl?session=<compressed>`. Building and parsing is pure
 * (a base URL can be injected for tests), and the payload is validated end to
 * end on read. Oversized links are rejected with a clear reason so the UI can
 * offer file export instead.
 *
 * Cloud storage is deliberately not implemented here. The
 * {@link CloudSessionProvider} interface is the single seam a future provider
 * (GitHub Gist, Supabase, Firebase, Cloudflare KV, Vercel Blob) implements;
 * the serialized session format does not change.
 */

/** Practical URL length cap. Real browsers allow far more, but proxies,
 * messengers and copy-paste truncate long URLs — over this we stop pretending
 * a link will survive and suggest a file instead. */
export const MAX_SHARE_LINK_LENGTH = 8_000;

export const SHARE_PARAM = "session";

/** Default base URL (browser-aware; deterministic for tests). */
export function defaultShareBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return "https://codescope.app";
}

export type ShareLinkResult =
  | { readonly ok: true; readonly url: string; readonly length: number; readonly encoded: string }
  | { readonly ok: false; readonly reason: "too-large"; readonly length: number; readonly maxLength: number };

/**
 * Build a share link for a session. When the compressed payload exceeds
 * `maxLength`, returns `{ ok: false, reason: "too-large" }` so callers can
 * offer file export instead of a broken link.
 */
export function buildShareLink(
  session: Session,
  options: { readonly base?: string; readonly maxLength?: number } = {},
): ShareLinkResult {
  const encoded = compressSession(session);
  const maxLength = options.maxLength ?? MAX_SHARE_LINK_LENGTH;
  const url = `${options.base ?? defaultShareBase()}?${SHARE_PARAM}=${encoded}`;

  if (url.length > maxLength) {
    return { ok: false, reason: "too-large", length: url.length, maxLength };
  }
  return { ok: true, url, length: url.length, encoded };
}

/** Extract the `?session=` payload from a URL, or null when absent. */
export function readSharePayload(url: string): string | null {
  const queryStart = url.indexOf("?");
  if (queryStart < 0) return null;
  const query = url.slice(queryStart + 1);
  for (const part of query.split("&")) {
    const eq = part.indexOf("=");
    const key = eq < 0 ? part : part.slice(0, eq);
    const value = eq < 0 ? "" : part.slice(eq + 1);
    if (key === SHARE_PARAM) return value;
  }
  return null;
}

/** True when a URL carries a session payload. */
export function hasSharePayload(url: string): boolean {
  return readSharePayload(url) !== null;
}

/** URL with the `?session=` parameter removed (used after restore). */
export function stripShareParam(url: string): string {
  const queryStart = url.indexOf("?");
  if (queryStart < 0) return url;
  const before = url.slice(0, queryStart);
  const query = url.slice(queryStart + 1);
  const kept = query
    .split("&")
    .filter((part) => {
      const eq = part.indexOf("=");
      const key = eq < 0 ? part : part.slice(0, eq);
      return key !== SHARE_PARAM;
    })
    .join("&");
  return kept ? `${before}?${kept}` : before;
}

/** Decompress + validate a share payload found in a URL. */
export function shareSessionFromEncoded(encoded: string): SessionResult {
  if (!isShareEncoded(encoded)) {
    return { ok: false, error: { code: "not-object", message: "This share link is not a valid CodeScope session." } };
  }
  return decompressSession(encoded);
}

/** Full pipeline: URL → session. */
export function shareSessionFromUrl(url: string): SessionResult {
  const encoded = readSharePayload(url);
  if (encoded === null) {
    return { ok: false, error: { code: "not-object", message: "No session is attached to this URL." } };
  }
  return shareSessionFromEncoded(encoded);
}

/**
 * The cloud storage seam. Future providers implement this and register
 * themselves; the session format never changes.
 */
export interface CloudSessionProvider {
  /** Provider id, e.g. "github-gist" | "supabase" | "firebase" | "cloudflare-kv". */
  readonly kind: string;
  /** Human label for pickers. */
  readonly label: string;
  /** Persist a session, returning an opaque reference to load it again. */
  save(session: Session): Promise<string>;
  /** Load a session by reference; rejects when missing/invalid. */
  load(reference: string): Promise<Session>;
  /** Delete a saved session. */
  delete(reference: string): Promise<void>;
  /** Whether this provider can run in the current environment (default true). */
  available?(): boolean;
}

const cloudProviders = new Map<string, CloudSessionProvider>();

/** Register a cloud provider (no-op when a provider with the same kind exists). */
export function registerCloudProvider(provider: CloudSessionProvider): boolean {
  if (cloudProviders.has(provider.kind)) return false;
  cloudProviders.set(provider.kind, provider);
  return true;
}

/** Look up a registered cloud provider. */
export function getCloudProvider(kind: string): CloudSessionProvider | undefined {
  return cloudProviders.get(kind);
}

/** Kinds of all registered cloud providers. */
export function listCloudProviders(): readonly string[] {
  return [...cloudProviders.keys()];
}

/** A share URL for manual inspection / debugging. */
export function shareUrlPreview(session: Session): string {
  return serializeSession(session);
}
