/**
 * Core shared types for the CodeScope execution engine.
 *
 * The engine is deliberately framework-agnostic: it never imports React,
 * so it can run in the browser, in Node tests, or in a web worker.
 */

/**
 * A unique handle to an object or array living on the runtime heap.
 *
 * Variables never store objects directly — they store a reference, exactly
 * like JavaScript. Two variables holding the "same" reference point at the
 * same heap node, so mutation through one is visible through the other.
 * Instances are canonical per id and always frozen, so `===` compares
 * identity correctly and snapshots stay immutable.
 */
export interface HeapReference {
  readonly id: string;
}

/**
 * The only kinds of values the interpreter can produce.
 * Always JSON-serializable: primitives plus heap references.
 */
export type RuntimeValue = number | string | boolean | null | undefined | HeapReference;

/** A heap node that holds named properties (a plain object). */
export interface HeapObject {
  readonly id: string;
  readonly type: "object";
  readonly properties: Readonly<Record<string, RuntimeValue>>;
}

/** A heap node that holds indexed elements (an array). */
export interface HeapArray {
  readonly id: string;
  readonly type: "array";
  readonly elements: readonly RuntimeValue[];
}

/** Any node stored on the heap. */
export type HeapNode = HeapObject | HeapArray;

/** True when `value` is a heap reference (object/array handle). */
export function isHeapReference(value: unknown): value is HeapReference {
  return typeof value === "object" && value !== null && typeof (value as HeapReference).id === "string";
}

/** Flat, JSON-serializable view of the current scope. */
export type VariableRecord = Record<string, RuntimeValue>;

/** One captured line of console output. */
export type ConsoleLine = string;

export type BindingKind = "let" | "const" | "var";

/**
 * One frame on the active call stack.
 *
 * A frame is pushed when a function is entered and popped when it returns.
 * `variables` holds only what is visible inside that frame (its parameters
 * and locals, plus anything declared in nested blocks), so the UI can render
 * the stack as an isolated, per-function view. Frames are always frozen.
 */
export interface CallFrame {
  /** Stable, unique identifier used for animations and the current-frame marker. */
  readonly id: string;
  /** Name of the function this frame belongs to. */
  readonly name: string;
  /** Parameters and locals visible inside this frame, innermost scope last. */
  readonly variables: VariableRecord;
  /** 1-based source line the frame is currently stopped at (0 when unknown). */
  readonly line: number;
}

/**
 * An immutable execution snapshot.
 *
 * Snapshots are never mutated after creation. Each one carries fresh copies
 * of `variables`, `console` and `callStack`, so the UI can safely render,
 * diff, and even reverse time by simply pointing at a different snapshot.
 */
export interface Snapshot {
  /** Position in the execution timeline (0-based). */
  readonly index: number;
  /** 1-based source line of the statement that produced this snapshot (0 = program start). */
  readonly line: number;
  /** All variables in scope at the moment the statement finished. */
  readonly variables: VariableRecord;
  /** All console output up to and including this snapshot. */
  readonly console: readonly ConsoleLine[];
  /** Human-readable summary of the step that just ran. */
  readonly description: string;
  /** Source text of the evaluated condition, present on decision snapshots. */
  readonly condition?: string;
  /** Boolean outcome of a decision snapshot (e.g. an `if` condition). */
  readonly conditionResult?: boolean;
  /** Loop construct that produced this snapshot, when it belongs to a loop. */
  readonly loopType?: "for" | "while" | "do-while";
  /** 1-based iteration number for snapshots produced inside a loop. */
  readonly iteration?: number;
  /** Active call stack at this point, outermost frame first, innermost last. */
  readonly callStack?: readonly CallFrame[];
  /** Id of the currently highlighted (innermost) frame, when inside a function. */
  readonly CurrentFrame?: string;
  /**
   * Snapshot of the runtime heap at this point: every allocated object and
   * array, keyed by reference id. Present once any heap feature runs.
   */
  readonly heap?: readonly HeapNode[];
}

export type ExecutionErrorKind = "parse" | "unsupported" | "runtime";

/** A safe, serializable description of anything that went wrong. */
export interface ExecutionError {
  readonly kind: ExecutionErrorKind;
  readonly message: string;
  /** 1-based line of the offending statement, when known. */
  readonly line?: number;
  readonly column?: number;
  /** Babel node type involved in an "unsupported syntax" error. */
  readonly nodeType?: string;
}

export type ExecutionResult =
  | { readonly ok: true; readonly snapshots: readonly Snapshot[] }
  | {
      readonly ok: false;
      readonly error: ExecutionError;
      /** Snapshots produced before the failure (never empty). */
      readonly snapshots: readonly Snapshot[];
    };

/**
 * Error used internally by the engine. Carries machine-readable metadata so
 * the UI can render a friendly panel instead of a raw stack trace.
 */
export class CodeScopeError extends Error {
  readonly kind: ExecutionErrorKind;
  line?: number;
  column?: number;
  readonly nodeType?: string;

  constructor(opts: {
    kind: ExecutionErrorKind;
    message: string;
    line?: number;
    column?: number;
    nodeType?: string;
  }) {
    super(opts.message);
    this.name = "CodeScopeError";
    this.kind = opts.kind;
    this.line = opts.line;
    this.column = opts.column;
    this.nodeType = opts.nodeType;
  }

  /** Backfill line/column information from a statement when missing. */
  attachLocation(loc: { line?: number; column?: number } | null | undefined): this {
    if (loc && this.line == null && loc.line != null) {
      this.line = loc.line;
      this.column = loc.column;
    }
    return this;
  }

  toExecutionError(): ExecutionError {
    return {
      kind: this.kind,
      message: this.message,
      line: this.line,
      column: this.column,
      nodeType: this.nodeType,
    };
  }
}
