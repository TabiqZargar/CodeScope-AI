import type { ConsoleLine, Snapshot, VariableRecord } from "./types";

/**
 * Build an immutable snapshot.
 *
 * Both `variables` and `console` are copied (and frozen) at creation time.
 * Previous snapshots are never touched, which is what makes time travel and
 * timeline scrubbing trivial — the UI just indexes into the array.
 */
export function createSnapshot(params: {
  index: number;
  line: number;
  variables: VariableRecord;
  console: readonly ConsoleLine[];
  description: string;
}): Snapshot {
  return Object.freeze({
    index: params.index,
    line: params.line,
    variables: params.variables,
    console: Object.freeze([...params.console]),
    description: params.description,
  });
}

/** The state a program starts from: empty scope, empty console, line 0. */
export function createInitialSnapshot(): Snapshot {
  return createSnapshot({
    index: 0,
    line: 0,
    variables: Object.freeze({}),
    console: Object.freeze([]),
    description: "Program initialized. Ready to execute.",
  });
}
