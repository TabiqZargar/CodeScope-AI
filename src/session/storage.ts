import { deserializeSession } from "./deserialize";
import { serializeSession } from "./serialize";
import type { Session, SessionResult } from "./types";

/**
 * Local persistence (auto-save + restore) via Web Storage.
 *
 * Storage is injectable so tests can run headless with a memory-backed store
 * while the browser uses `localStorage`. Everything stored goes through the
 * same validate-on-write/read pipeline as import and share.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Key under which the latest session is auto-saved. */
export const AUTOSAVE_KEY = "codescope.session.autosave.v1";

/** The active storage backend (browser localStorage when available). */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      const storage = (globalThis as { localStorage: StorageLike }).localStorage;
      storage.getItem("codescope.session.probe");
      return storage;
    }
  } catch {
    // storage disabled (private mode, SSR)
  }
  return null;
}

/** True when a saved session exists. */
export function hasStoredSession(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(AUTOSAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Load + validate the auto-saved session. Null when absent or invalid. */
export function loadStoredSession(storage: StorageLike | null = defaultStorage()): Session | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const result: SessionResult = deserializeSession(raw);
  if (!result.ok) {
    // Corrupted/stale auto-save: drop it so it cannot keep failing.
    try {
      storage.removeItem(AUTOSAVE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
  return result.session;
}

/** Persist a session under the auto-save key (canonical JSON). */
export function storeSession(session: Session, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(AUTOSAVE_KEY, serializeSession(session));
    return true;
  } catch {
    return false;
  }
}

/** Remove the auto-saved session. */
export function clearStoredSession(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(AUTOSAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** An in-memory storage backend (tests, SSR fallback). */
export function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      data.set(key, value);
    },
    removeItem(key: string): void {
      data.delete(key);
    },
  };
}
