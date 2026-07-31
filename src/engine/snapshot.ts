import type { CallFrame, ConsoleLine, HeapNode, Snapshot, VariableRecord } from "./types";

/**
 * Build an immutable snapshot.
 *
 * `variables`, `console`, `heap` and `callStack` are all copied (and frozen)
 * at creation time — every frame's variable record gets its own frozen copy
 * too. Previous snapshots are never touched, which is what makes time travel
 * and timeline scrubbing trivial — the UI just indexes into the array.
 */
export function createSnapshot(params: {
  index: number;
  line: number;
  variables: VariableRecord;
  console: readonly ConsoleLine[];
  description: string;
  condition?: string;
  conditionResult?: boolean;
  loopType?: "for" | "while" | "do-while";
  iteration?: number;
  callStack?: readonly CallFrame[];
  CurrentFrame?: string;
  heap?: readonly HeapNode[];
}): Snapshot {
  return Object.freeze({
    index: params.index,
    line: params.line,
    variables: params.variables,
    console: Object.freeze([...params.console]),
    description: params.description,
    ...(params.condition !== undefined ? { condition: params.condition } : {}),
    ...(params.conditionResult !== undefined ? { conditionResult: params.conditionResult } : {}),
    ...(params.loopType !== undefined ? { loopType: params.loopType } : {}),
    ...(params.iteration !== undefined ? { iteration: params.iteration } : {}),
    ...(params.callStack !== undefined ? { callStack: freezeCallStack(params.callStack) } : {}),
    ...(params.CurrentFrame !== undefined ? { CurrentFrame: params.CurrentFrame } : {}),
    ...(params.heap !== undefined ? { heap: freezeHeap(params.heap) } : {}),
  });
}

/** Deep-freeze a call stack: the array, each frame, and each frame's variables. */
function freezeCallStack(callStack: readonly CallFrame[]): readonly CallFrame[] {
  return Object.freeze(
    callStack.map((frame) =>
      Object.freeze({
        ...frame,
        variables: Object.freeze({ ...frame.variables }),
      }),
    ),
  );
}

/**
 * Deep-freeze a heap: the array, each node, and each node's entries. Property
 * objects and element arrays are copied so later heap mutations never reach
 * past snapshots.
 */
function freezeHeap(heap: readonly HeapNode[]): readonly HeapNode[] {
  return Object.freeze(
    heap.map((node) => {
      if (node.type === "array") {
        return Object.freeze({
          id: node.id,
          type: "array",
          elements: Object.freeze([...node.elements]),
        });
      }
      return Object.freeze({
        id: node.id,
        type: "object",
        properties: Object.freeze({ ...node.properties }),
      });
    }),
  );
}

/** The state a program starts from: empty scope, empty console, empty stack. */
export function createInitialSnapshot(): Snapshot {
  return createSnapshot({
    index: 0,
    line: 0,
    variables: Object.freeze({}),
    console: Object.freeze([]),
    description: "Program initialized. Ready to execute.",
    callStack: Object.freeze([]),
  });
}
