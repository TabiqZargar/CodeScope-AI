import type { Snapshot } from "../engine/types";
import type { Explanation, ExplanationCache } from "./types";

/**
 * Explanation caching.
 *
 * The cache key is derived from a deterministic hash of the snapshot facts
 * (plus its chronological predecessor and the provider/model pair), so a step
 * that has already been explained is served instantly without a repeated API
 * call. Hashing is stable within and across runs (no randomness, canonical
 * ordering), which is what makes the cache correct.
 */

/** FNV-1a 32-bit hash, rendered as hex. Stable and dependency-free. */
export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Canonical JSON: object keys sorted recursively for deterministic output. */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Deterministic hash of one snapshot's explainable facts. */
export function snapshotHash(snapshot: Snapshot): string {
  const projection = {
    line: snapshot.line,
    description: snapshot.description,
    variables: snapshot.variables,
    console: snapshot.console,
    condition: snapshot.condition,
    conditionResult: snapshot.conditionResult,
    loop: snapshot.loopType,
    iteration: snapshot.iteration,
    callStack: (snapshot.callStack ?? []).map((frame) => ({
      name: frame.name,
      variables: frame.variables,
    })),
    heap: (snapshot.heap ?? []).map((node) =>
      node.type === "object"
        ? { id: node.id, type: node.type, properties: node.properties }
        : { id: node.id, type: node.type, elements: node.elements },
    ),
  };
  return hashString(canonicalize(projection));
}

/**
 * Cache key for an explanation: snapshot hash + previous snapshot hash +
 * provider + model. Two steps produce the same key only when they are
 * indistinguishable to the explainer.
 */
export function explanationCacheKey(
  snapshot: Snapshot,
  previous: Snapshot | undefined,
  provider: string,
  model: string,
): string {
  const current = snapshotHash(snapshot);
  const prior = previous ? snapshotHash(previous) : "";
  return hashString(`${provider}|${model}|${current}|${prior}`);
}

const DEFAULT_CACHE_LIMIT = 250;

/**
 * An in-memory, bounded explanation cache (LRU-ish: oldest entries are
 * evicted first once the limit is reached). A session rarely needs more, and
 * the bound keeps memory flat even when the user steps through a 10 000-step
 * timeline.
 */
export function createInMemoryCache(limit: number = DEFAULT_CACHE_LIMIT): ExplanationCache {
  const store = new Map<string, Explanation>();

  return {
    get(key) {
      return store.get(key);
    },
    set(key, explanation) {
      store.delete(key);
      store.set(key, explanation);
      while (store.size > limit) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    has(key) {
      return store.has(key);
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
}
