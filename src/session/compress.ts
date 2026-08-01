import { compressToBase64, decompressFromBase64 } from "lz-string";
import { deserializeSession } from "./deserialize";
import { serializeSession } from "./serialize";
import type { Session, SessionResult } from "./types";

/**
 * Compression for sharing.
 *
 * Sessions are compressed with lz-string and encoded as URL-safe base64 so the
 * payload survives URLs, clipboard text and storage without corruption.
 * Encoding is deterministic: the same session always compresses to the same
 * string (which also makes share links stable).
 */

const URL_SAFE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\+/g, "-"],
  [/\//g, "_"],
  [/=+$/g, ""],
];

function toUrlSafeBase64(base64: string): string {
  let out = base64;
  for (const [pattern, replacement] of URL_SAFE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function fromUrlSafeBase64(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  return padding === 2 ? `${base64}==` : padding === 3 ? `${base64}=` : base64;
}

/** Compress arbitrary text to URL-safe base64 (lz-string). */
export function compressText(text: string): string {
  return toUrlSafeBase64(compressToBase64(text));
}

/** Decompress URL-safe base64 back to text. Returns null when invalid. */
export function decompressText(encoded: string): string | null {
  if (typeof encoded !== "string" || encoded.length === 0) return null;
  try {
    const decoded = decompressFromBase64(fromUrlSafeBase64(encoded));
    return typeof decoded === "string" && decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/** Compress a session to its share encoding. */
export function compressSession(session: Session): string {
  return compressText(serializeSession(session));
}

/** True when a string looks like a valid URL-safe base64 payload. */
export function isShareEncoded(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

// Memoize decompression: the same share payload is decoded at most once per
// page load (e.g. a share URL restored once, or a link inspected twice), and
// lz-string + validation is the most expensive step in the session pipeline.
const decompressCache = new Map<string, SessionResult>();
const DECOMPRESS_CACHE_MAX = 32;

/** Decompress + deserialize a share payload into a validated session. */
export function decompressSession(encoded: string): SessionResult {
  const cached = decompressCache.get(encoded);
  if (cached) return cached;

  const text = decompressText(encoded);
  const result = text === null ? ({ ok: false, error: { code: "not-object", message: "This share link is corrupted." } } as SessionResult) : deserializeSession(text);

  if (decompressCache.size >= DECOMPRESS_CACHE_MAX) {
    const oldest = decompressCache.keys().next().value;
    if (oldest !== undefined) decompressCache.delete(oldest);
  }
  decompressCache.set(encoded, result);
  return result;
}

/** Clear the internal decompression memo (mainly for tests). */
export function clearCompressionCache(): void {
  decompressCache.clear();
}
