import type { HeapNode, RuntimeValue, Snapshot } from "../engine";

/** One variable that changed value between two adjacent snapshots. */
export interface VariableChange {
  readonly name: string;
  readonly before: RuntimeValue;
  readonly after: RuntimeValue;
}

/**
 * Everything that changed between two adjacent snapshots.
 *
 * Computed purely from the two snapshots — never from interpreter state — so
 * it works identically going forward and backward through the timeline, and
 * for arbitrary snapshot pairs. "Only changed values animate" is driven
 * directly by these lists.
 */
export interface SnapshotDiff {
  /** Variables present now but not before. */
  readonly addedVariables: readonly string[];
  /** Variables whose value changed (name + before + after). */
  readonly changedVariables: readonly VariableChange[];
  /** Variables present before but gone now (rare; scopes never leak). */
  readonly removedVariables: readonly string[];
  /** Console lines appended since the previous snapshot. */
  readonly consoleAdded: readonly string[];
  /** Call-stack depth delta (positive = frames pushed). */
  readonly framesAdded: number;
  /** Call-stack depth delta (positive = frames popped). */
  readonly framesRemoved: number;
  /** Heap node ids created since the previous snapshot. */
  readonly heapAdded: readonly string[];
  /** Heap node ids that existed before and changed content. */
  readonly heapChanged: readonly string[];
  /** Heap node ids that existed before and are gone now. */
  readonly heapRemoved: readonly string[];
}

const EMPTY_DIFF: SnapshotDiff = Object.freeze({
  addedVariables: [],
  changedVariables: [],
  removedVariables: [],
  consoleAdded: [],
  framesAdded: 0,
  framesRemoved: 0,
  heapAdded: [],
  heapChanged: [],
  heapRemoved: [],
});

/**
 * Diff two adjacent snapshots. `previous` or `next` may be undefined (edge of
 * the timeline); the result then describes everything present on one side.
 */
export function computeDiff(
  previous: Snapshot | undefined,
  next: Snapshot | undefined,
): SnapshotDiff {
  if (next === undefined) return EMPTY_DIFF;
  if (previous === undefined) {
    return Object.freeze({
      addedVariables: Object.keys(next.variables),
      changedVariables: [],
      removedVariables: [],
      consoleAdded: [...next.console],
      framesAdded: next.callStack?.length ?? 0,
      framesRemoved: 0,
      heapAdded: (next.heap ?? []).map((node) => node.id),
      heapChanged: [],
      heapRemoved: [],
    });
  }

  return Object.freeze({
    addedVariables: diffVariables(previous, next).added,
    changedVariables: diffVariables(previous, next).changed,
    removedVariables: diffVariables(previous, next).removed,
    consoleAdded: diffConsole(previous, next),
    framesAdded: Math.max(0, frameCount(next) - frameCount(previous)),
    framesRemoved: Math.max(0, frameCount(previous) - frameCount(next)),
    heapAdded: diffHeap(previous, next).added,
    heapChanged: diffHeap(previous, next).changed,
    heapRemoved: diffHeap(previous, next).removed,
  });
}

const frameCount = (snapshot: Snapshot): number => snapshot.callStack?.length ?? 0;

function diffVariables(previous: Snapshot, next: Snapshot): {
  added: string[];
  changed: VariableChange[];
  removed: string[];
} {
  const added: string[] = [];
  const changed: VariableChange[] = [];
  const removed: string[] = [];

  for (const name of Object.keys(next.variables)) {
    const after = next.variables[name];
    if (!(name in previous.variables)) {
      added.push(name);
    } else if (!Object.is(previous.variables[name], after)) {
      changed.push({ name, before: previous.variables[name], after });
    }
  }
  for (const name of Object.keys(previous.variables)) {
    if (!(name in next.variables)) removed.push(name);
  }

  return { added, changed, removed };
}

function diffConsole(previous: Snapshot, next: Snapshot): string[] {
  const prior = previous.console.length;
  return next.console.slice(prior);
}

function diffHeap(previous: Snapshot, next: Snapshot): {
  added: string[];
  changed: string[];
  removed: string[];
} {
  const prevNodes = new Map((previous.heap ?? []).map((node) => [node.id, node]));
  const nextNodes = new Map((next.heap ?? []).map((node) => [node.id, node]));

  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const [id, nextNode] of nextNodes) {
    const prevNode = prevNodes.get(id);
    if (!prevNode) {
      added.push(id);
    } else if (heapNodeChanged(prevNode, nextNode)) {
      changed.push(id);
    }
  }
  for (const id of prevNodes.keys()) {
    if (!nextNodes.has(id)) removed.push(id);
  }

  return { added, changed, removed };
}

/** True when two heap nodes with the same id hold different content. */
function heapNodeChanged(a: HeapNode, b: HeapNode): boolean {
  if (a.type !== b.type) return true;
  if (a.type === "array" && b.type === "array") {
    if (a.elements.length !== b.elements.length) return true;
    return a.elements.some((element, i) => !Object.is(element, b.elements[i]));
  }
  if (a.type === "object" && b.type === "object") {
    const keysA = Object.keys(a.properties);
    const keysB = Object.keys(b.properties);
    if (keysA.length !== keysB.length) return true;
    return keysA.some((key) => !Object.is(a.properties[key], b.properties[key]));
  }
  return true;
}
