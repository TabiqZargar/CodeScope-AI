import type { Snapshot } from "../engine";
import { enabledBreakpointLines, snapshotHitsBreakpoint } from "./breakpoints";
import type { BreakpointState } from "./breakpoints";
/**
 * Debugger playback commands — pure math over snapshots.
 *
 * Continue / Jump To Next Breakpoint / Jump To Previous Breakpoint simply
 * locate matching snapshots; they never re-execute code. Breakpoint jumps use
 * the precomputed line index so large timelines are searched with a binary
 * scan over enabled breakpoint lines only (no full-timeline sweep).
 *
 * Keyboard mapping for the F-keys is kept here so it is unit-testable:
 *   F5 Continue · Shift+F5 Stop · F9 Toggle breakpoint
 *   F10 Next snapshot · Shift+F10 Previous snapshot
 */
export type DebuggerCommand =
  | { readonly type: "continue" }
  | { readonly type: "stop" }
  | { readonly type: "step"; readonly delta: 1 | -1 }
  | { readonly type: "toggle-breakpoint" }
  | { readonly type: "jump-next-breakpoint" }
  | { readonly type: "jump-previous-breakpoint" }
  | { readonly type: "none" };

/** Map a keyboard event (key + shift) to a debugger command. */
export function resolveDebuggerKey(key: string, shiftKey: boolean): DebuggerCommand {
  const upper = key.toUpperCase();
  if (upper === "F5") return shiftKey ? { type: "stop" } : { type: "continue" };
  if (upper === "F9") return { type: "toggle-breakpoint" };
  if (upper === "F10") return shiftKey ? { type: "step", delta: -1 } : { type: "step", delta: 1 };
  return { type: "none" };
}

/** Target index when playback advances one snapshot (clamped to the timeline). */
export function continueTarget(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(index + 1, length - 1);
}

/** Target index for a step command (clamped to the timeline). */
export function stepTarget(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index + delta, 0), length - 1);
}

/** O(1): should playback pause on this snapshot? */
export function shouldStopAtSnapshot(snapshot: Snapshot, breakpoints: BreakpointState): boolean {
  return snapshotHitsBreakpoint(snapshot, breakpoints);
}

/**
 * First snapshot index strictly after `fromIndex` whose line has an enabled
 * breakpoint, or -1 when playback can run to the end untouched.
 */
export function findNextBreakpointIndex(
  fromIndex: number,
  breakpoints: BreakpointState,
  lineIndex: ReadonlyMap<number, readonly number[]>,
): number {
  let best = -1;
  for (const line of enabledBreakpointLines(breakpoints)) {
    const indices = lineIndex.get(line);
    if (!indices || indices.length === 0) continue;
    let low = 0;
    let high = indices.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (indices[mid] <= fromIndex) low = mid + 1;
      else high = mid;
    }
    if (low < indices.length && (best === -1 || indices[low] < best)) best = indices[low];
  }
  return best;
}

/** Last snapshot index strictly before `fromIndex` with an enabled breakpoint. */
export function findPreviousBreakpointIndex(
  fromIndex: number,
  breakpoints: BreakpointState,
  lineIndex: ReadonlyMap<number, readonly number[]>,
): number {
  let best = -1;
  for (const line of enabledBreakpointLines(breakpoints)) {
    const indices = lineIndex.get(line);
    if (!indices || indices.length === 0) continue;
    let low = 0;
    let high = indices.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (indices[mid] < fromIndex) low = mid + 1;
      else high = mid;
    }
    if (low > 0 && (best === -1 || indices[low - 1] > best)) best = indices[low - 1];
  }
  return best;
}
