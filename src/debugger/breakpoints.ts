import type { Snapshot } from "../engine";

/**
 * Breakpoints — pure, React-free state manipulation.
 *
 * Breakpoints are keyed by source line number and are UI state only: they
 * never touch the interpreter or snapshot generation. The hit test is O(1)
 * (a Map lookup by line), and jumping between breakpoints uses a precomputed
 * line → snapshot-index index so a 10 000-step timeline is never scanned
 * wholesale.
 *
 * Extensibility: conditional breakpoints, logpoints and hit counts later add
 * fields to {@link Breakpoint} (e.g. `condition`, `hitCount`) without changing
 * the state shape below.
 */
export interface Breakpoint {
  /** 1-based source line this breakpoint is attached to. */
  readonly line: number;
  /** Disabled breakpoints render hollow and never stop playback. */
  readonly enabled: boolean;
  /** Reserved for conditional breakpoints / logpoints / hit counts. */
  readonly payload?: unknown;
}

/** Immutable breakpoint set; always replaced, never mutated. */
export type BreakpointState = ReadonlyMap<number, Breakpoint>;

/** Shared empty state. Frozen so nothing can ever hand-mutate it. */
export const EMPTY_BREAKPOINTS: BreakpointState = Object.freeze(new Map());

/** The breakpoint on `line`, or undefined. O(1). */
export function breakpointAtLine(state: BreakpointState, line: number): Breakpoint | undefined {
  return state.get(line);
}

/** Number of breakpoints (enabled or not). */
export function breakpointCount(state: BreakpointState): number {
  return state.size;
}

/** Lines that currently have an enabled breakpoint. */
export function enabledBreakpointLines(state: BreakpointState): ReadonlySet<number> {
  const lines = new Set<number>();
  for (const breakpoint of state.values()) {
    if (breakpoint.enabled) lines.add(breakpoint.line);
  }
  return lines;
}

/** Number of enabled breakpoints. */
export function enabledBreakpointCount(state: BreakpointState): number {
  let count = 0;
  for (const breakpoint of state.values()) if (breakpoint.enabled) count += 1;
  return count;
}

/** O(1) check: does `line` have an enabled breakpoint? */
export function hasEnabledBreakpoint(state: BreakpointState, line: number): boolean {
  return state.get(line)?.enabled === true;
}

/** O(1) hit test against one snapshot (its line). */
export function snapshotHitsBreakpoint(snapshot: Snapshot, state: BreakpointState): boolean {
  return snapshot.line > 0 && state.get(snapshot.line)?.enabled === true;
}

/** Toggle a breakpoint on `line`: add (enabled) or remove. */
export function toggleBreakpoint(state: BreakpointState, line: number): BreakpointState {
  if (line <= 0) return state;
  const next = new Map(state);
  if (next.has(line)) {
    next.delete(line);
  } else {
    next.set(line, { line, enabled: true });
  }
  return next;
}

/** Enable or disable an existing breakpoint (no-op when absent). */
export function setBreakpointEnabled(
  state: BreakpointState,
  line: number,
  enabled: boolean,
): BreakpointState {
  const existing = state.get(line);
  if (!existing || existing.enabled === enabled) return state;
  const next = new Map(state);
  next.set(line, { ...existing, enabled });
  return next;
}

/** Remove the breakpoint on `line` if present. */
export function removeBreakpoint(state: BreakpointState, line: number): BreakpointState {
  if (!state.has(line)) return state;
  const next = new Map(state);
  next.delete(line);
  return next;
}

/** Remove every breakpoint. */
export function clearBreakpoints(): BreakpointState {
  return EMPTY_BREAKPOINTS;
}

/**
 * Precompute a line → snapshot-indices index once per timeline. Subsequent
 * "next/previous breakpoint" lookups are then O(#enabled lines · log N)
 * binary searches instead of full scans.
 */
export function buildBreakpointIndex(
  snapshots: readonly Snapshot[],
): ReadonlyMap<number, readonly number[]> {
  const index = new Map<number, number[]>();
  for (let i = 0; i < snapshots.length; i += 1) {
    const line = snapshots[i].line;
    if (line <= 0) continue;
    const hits = index.get(line);
    if (hits) hits.push(i);
    else index.set(line, [i]);
  }
  return index;
}
