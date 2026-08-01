import type { CallFrame, HeapNode, Snapshot, VariableRecord } from "../engine";
import { computeDiff, type SnapshotDiff } from "./diff";
import { classifySnapshot, type SnapshotType } from "./snapshot-type";

/**
 * Snapshot inspector — a pure projection of one snapshot.
 *
 * Clicking a timeline node opens an inspector; everything it displays is
 * derived here from the immutable snapshots (description, line, type,
 * variables, call stack, heap, console, loop/condition metadata, and the
 * reuse of the existing diff engine for "only changed values"). No
 * interpreter state is involved.
 */
export interface SnapshotInspection {
  /** 0-based timeline index. */
  readonly index: number;
  /** 1-based step number (index + 1). */
  readonly step: number;
  /** 1-based source line (0 when unknown). */
  readonly line: number;
  readonly description: string;
  /** Snapshot type inferred by the debugger's classifier. */
  readonly type: SnapshotType;
  readonly variables: VariableRecord;
  readonly callStack: readonly CallFrame[];
  readonly heap: readonly HeapNode[];
  readonly console: readonly string[];
  /** Decision metadata, present on condition snapshots. */
  readonly condition?: string;
  readonly conditionResult?: boolean;
  /** Loop metadata, present on snapshots produced inside a loop. */
  readonly loopType?: Snapshot["loopType"];
  readonly iteration?: number;
  /** What changed since the previous snapshot (reuses the diff engine). */
  readonly diff: SnapshotDiff;
}

/** Inspect the snapshot at `index`, or null when the index is out of range. */
export function inspectSnapshot(
  snapshots: readonly Snapshot[],
  index: number,
): SnapshotInspection | null {
  const snapshot = snapshots[index];
  if (!snapshot) return null;
  const previous = snapshots[index - 1];
  return {
    index: snapshot.index,
    step: snapshot.index + 1,
    line: snapshot.line,
    description: snapshot.description,
    type: classifySnapshot(snapshot, previous),
    variables: snapshot.variables,
    callStack: snapshot.callStack ?? [],
    heap: snapshot.heap ?? [],
    console: snapshot.console,
    condition: snapshot.condition,
    conditionResult: snapshot.conditionResult,
    loopType: snapshot.loopType,
    iteration: snapshot.iteration,
    diff: computeDiff(previous, snapshot),
  };
}
