import type { Snapshot } from "../engine";

/**
 * Debugger-side classification of a snapshot.
 *
 * Lives entirely outside the execution engine: nothing here is emitted by the
 * interpreter. The UI infers a "type" for every timeline node so it can render
 * an icon, color, and legend — and future features (breakpoints, watch
 * expressions, AI explanations) can extend the classifier registry without
 * touching interpreter code.
 */
export type SnapshotType =
  | "declaration"
  | "assignment"
  | "condition"
  | "loop"
  | "call"
  | "return"
  | "console"
  | "other";

/** A single classifier. Returns a type, or null to let the next one decide. */
export type SnapshotClassifier = (
  snapshot: Snapshot,
  previous?: Snapshot,
) => SnapshotType | null;

const frameCount = (snapshot: Snapshot): number => snapshot.callStack?.length ?? 0;

/**
 * Default classifiers, in priority order. Deterministic and snapshot-driven:
 * a type is decided purely from the current snapshot and its immediate
 * predecessor (call-stack depth deltas, description text, console growth).
 */
export const SNAPSHOT_CLASSIFIERS: readonly SnapshotClassifier[] = [
  // Call: a new function frame appeared.
  (snapshot) => (snapshot.description.startsWith("Entering function ") ? "call" : null),
  (snapshot, previous) =>
    previous !== undefined && frameCount(snapshot) > frameCount(previous) ? "call" : null,
  // Return: a frame disappeared, or an explicit return/leave snapshot.
  (snapshot) =>
    snapshot.description.startsWith("Leaving function ") ||
    snapshot.description.startsWith("Returning value ")
      ? "return"
      : null,
  (snapshot, previous) =>
    previous !== undefined && frameCount(snapshot) < frameCount(previous) ? "return" : null,
  // Console: new output arrived since the previous step.
  (snapshot, previous) =>
    snapshot.console.length > (previous?.console.length ?? 0) ? "console" : null,
  // Condition: the step evaluated a boolean test.
  (snapshot) => (snapshot.condition !== undefined ? "condition" : null),
  // Loop: the step belongs to a loop construct (init / update / body).
  (snapshot) => (snapshot.loopType !== undefined ? "loop" : null),
  // Declaration / assignment fall back on the engine's description text.
  (snapshot) => (snapshot.description.startsWith("Declared ") ? "declaration" : null),
  (snapshot) =>
    snapshot.description.startsWith("Assigned ") ||
    snapshot.description.startsWith("Incremented ") ||
    snapshot.description.startsWith("Decremented ")
      ? "assignment"
      : null,
];

/** Classify one snapshot relative to its chronological predecessor. */
export function classifySnapshot(snapshot: Snapshot, previous?: Snapshot): SnapshotType {
  for (const classifier of SNAPSHOT_CLASSIFIERS) {
    const type = classifier(snapshot, previous);
    if (type !== null) return type;
  }
  return "other";
}

/**
 * Classify a whole timeline. Single pass, linear in the number of snapshots;
 * safe for timelines with tens of thousands of nodes.
 */
export function classifyTimeline(snapshots: readonly Snapshot[]): readonly SnapshotType[] {
  const types: SnapshotType[] = new Array(snapshots.length);
  let previous: Snapshot | undefined;
  for (let i = 0; i < snapshots.length; i += 1) {
    types[i] = classifySnapshot(snapshots[i], previous);
    previous = snapshots[i];
  }
  return types;
}
