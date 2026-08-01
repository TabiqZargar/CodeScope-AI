import { formatValue } from "../engine/format";
import type { Snapshot } from "../engine";
import { watchHasValue } from "./watch";

/**
 * Timeline search — pure and snapshot-driven.
 *
 * A snapshot matches when every whitespace-separated query token appears in
 * its searchable text (description, variable names/values, function names,
 * heap reference ids and node contents, console output, condition text).
 *
 * Search also includes debugger state: snapshots whose line carries an enabled
 * breakpoint gain the token `breakpoint`, and snapshots where a watch
 * expression resolves to a defined value gain the expression text.
 *
 * For large timelines, precompute the search text per snapshot once
 * (`buildSearchIndex`) and re-run `searchTimeline` per keystroke; it stays a
 * cheap substring scan.
 */
export function snapshotSearchText(snapshot: Snapshot): string {
  const parts: string[] = [
    snapshot.description,
    `step ${snapshot.index + 1}`,
    `line ${snapshot.line}`,
  ];

  for (const [name, value] of Object.entries(snapshot.variables)) {
    parts.push(name, formatValue(value));
  }
  for (const frame of snapshot.callStack ?? []) {
    parts.push(frame.name);
    for (const [name, value] of Object.entries(frame.variables)) {
      parts.push(name, formatValue(value));
    }
  }
  if (snapshot.condition !== undefined) parts.push(snapshot.condition);
  if (snapshot.loopType !== undefined) parts.push(snapshot.loopType);
  if (snapshot.iteration !== undefined) parts.push(`iteration ${snapshot.iteration}`);
  if (snapshot.CurrentFrame !== undefined) parts.push(snapshot.CurrentFrame);
  for (const line of snapshot.console) parts.push(line);
  for (const node of snapshot.heap ?? []) {
    parts.push(node.id);
    if (node.type === "object") {
      for (const [key, value] of Object.entries(node.properties)) {
        parts.push(key, formatValue(value));
      }
    } else {
      for (const element of node.elements) parts.push(formatValue(element));
    }
  }

  return parts.join(" ").toLowerCase();
}

/** Extra searchable context derived from debugger state. */
export interface SearchExtras {
  /** Lines with an enabled breakpoint; snapshots there gain "breakpoint". */
  readonly breakpointLines?: ReadonlySet<number>;
  /** Watch expressions; snapshots where one resolves are searchable by it. */
  readonly watches?: readonly string[];
}

/** Precomputed, lowercased search text for every snapshot (parallel array). */
export function buildSearchIndex(
  snapshots: readonly Snapshot[],
  extras?: SearchExtras,
): readonly string[] {
  const breakpointLines = extras?.breakpointLines;
  const watches = extras?.watches;

  return snapshots.map((snapshot) => {
    let text = snapshotSearchText(snapshot);
    if (breakpointLines?.has(snapshot.line)) text += " breakpoint";
    if (watches && watches.length > 0) {
      for (const expression of watches) {
        if (watchHasValue(expression, snapshot)) text += ` ${expression.toLowerCase()}`;
      }
    }
    return text;
  });
}

/**
 * Indices of snapshots that match every token of `query`. An empty query
 * matches nothing (nothing is highlighted until the user types).
 */
export function searchTimeline(
  searchIndex: readonly string[],
  query: string,
): ReadonlySet<number> {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return new Set();

  const matches = new Set<number>();
  for (let i = 0; i < searchIndex.length; i += 1) {
    const haystack = searchIndex[i];
    if (tokens.every((token) => haystack.includes(token))) matches.add(i);
  }
  return matches;
}

/** Count of matching snapshots (O(matches), cheap for the header badge). */
export function countMatches(matches: ReadonlySet<number>): number {
  return matches.size;
}
