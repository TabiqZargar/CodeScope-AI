/**
 * Core shared types for the CodeScope execution engine.
 *
 * The engine is deliberately framework-agnostic: it never imports React,
 * so it can run in the browser, in Node tests, or in a web worker.
 */

/** The only kinds of values the interpreter can produce. Always JSON-serializable. */
export type RuntimeValue = number | string | boolean | null | undefined;

/** Flat, JSON-serializable view of the current scope. */
export type VariableRecord = Record<string, RuntimeValue>;

/** One captured line of console output. */
export type ConsoleLine = string;

export type BindingKind = "let" | "const" | "var";

/**
 * An immutable execution snapshot.
 *
 * Snapshots are never mutated after creation. Each one carries fresh copies
 * of `variables` and `console`, so the UI can safely render, diff, and even
 * reverse time by simply pointing at a different snapshot.
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
