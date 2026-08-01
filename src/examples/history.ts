import { listExamples } from "./registry";

/**
 * Local persistence for favorites and recent examples.
 *
 * Deliberately independent from the session layer: this module owns a tiny
 * storage contract and a memory implementation so it can be unit-tested
 * headlessly. `localStorage`-backed stores are created by the UI layer.
 */

/** Minimal key-value storage; mirrors the session layer's shape. */
export interface ExampleStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage for tests and non-browser environments. */
export function createMemoryStorage(): ExampleStorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Storage backed by `localStorage`, with a memory fallback off the client. */
export function createLocalStorageStorage(): ExampleStorageLike {
  const memory = createMemoryStorage();
  const backing = typeof window !== "undefined" ? window.localStorage : null;
  return {
    getItem: (key) => {
      try {
        return backing ? backing.getItem(key) : memory.getItem(key);
      } catch {
        return memory.getItem(key);
      }
    },
    setItem: (key, value) => {
      try {
        if (backing) backing.setItem(key, value);
        else memory.setItem(key, value);
      } catch {
        memory.setItem(key, value);
      }
    },
    removeItem: (key) => {
      try {
        if (backing) backing.removeItem(key);
        else memory.removeItem(key);
      } catch {
        memory.removeItem(key);
      }
    },
  };
}

export const FAVORITES_KEY = "codescope.examples.favorites.v1";
export const RECENT_KEY = "codescope.examples.recent.v1";
export const MAX_RECENT = 12;

function readIds(storage: ExampleStorageLike, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  } catch {
    return [];
  }
}

function writeIds(storage: ExampleStorageLike, key: string, ids: readonly string[]): void {
  storage.setItem(key, JSON.stringify(ids));
}

/** Favorites: an ordered id list; order reflects when each was added. */
export function loadFavorites(storage: ExampleStorageLike): string[] {
  const known = new Set(listExamples().map((example) => example.id));
  return readIds(storage, FAVORITES_KEY).filter((id) => known.has(id));
}

export function saveFavorites(storage: ExampleStorageLike, ids: readonly string[]): void {
  writeIds(storage, FAVORITES_KEY, ids);
}

export function isFavorite(storage: ExampleStorageLike, id: string): boolean {
  return loadFavorites(storage).includes(id);
}

export function toggleFavorite(storage: ExampleStorageLike, id: string): boolean {
  const favorites = loadFavorites(storage);
  const exists = favorites.includes(id);
  const next = exists ? favorites.filter((fav) => fav !== id) : [...favorites, id];
  saveFavorites(storage, next);
  return !exists;
}

/** Recents: most-recently-loaded first, deduped, capped. */
export function loadRecent(storage: ExampleStorageLike): string[] {
  const known = new Set(listExamples().map((example) => example.id));
  return readIds(storage, RECENT_KEY).filter((id) => known.has(id));
}

export function saveRecent(storage: ExampleStorageLike, ids: readonly string[]): void {
  writeIds(storage, RECENT_KEY, ids.slice(0, MAX_RECENT));
}

/** Move an example to the front of recents, or add it when new. */
export function recordRecent(storage: ExampleStorageLike, id: string): string[] {
  const known = listExamples().some((example) => example.id === id);
  if (!known) return loadRecent(storage);
  const recent = loadRecent(storage).filter((entry) => entry !== id);
  const next = [id, ...recent].slice(0, MAX_RECENT);
  saveRecent(storage, next);
  return next;
}

export function clearRecent(storage: ExampleStorageLike): void {
  storage.removeItem(RECENT_KEY);
}

export function clearFavorites(storage: ExampleStorageLike): void {
  storage.removeItem(FAVORITES_KEY);
}
