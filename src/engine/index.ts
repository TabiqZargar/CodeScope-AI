/**
 * CodeScope execution engine — public API.
 *
 * The engine has no React dependencies and never uses eval, Function, vm,
 * or any other unsafe code execution. Source is parsed to a Babel AST and
 * interpreted with a small, hand-written subset interpreter that emits
 * immutable snapshots.
 *
 *   code → AST → interpreter → snapshots[] → React UI (render only)
 */
import type { Program } from "@babel/types";
import { executeProgram, type ExecutionOptions } from "./interpreter";
import { parseSource } from "./parser";
import { createInitialSnapshot } from "./snapshot";
import { CodeScopeError, type ExecutionResult } from "./types";

export type {
  BindingKind,
  CallFrame,
  ConsoleLine,
  ExecutionError,
  ExecutionErrorKind,
  ExecutionResult,
  HeapArray,
  HeapNode,
  HeapObject,
  HeapReference,
  RuntimeValue,
  Snapshot,
  VariableRecord,
} from "./types";

export { CodeScopeError, isHeapReference } from "./types";
export { executeProgram, MAX_EXECUTION_STEPS } from "./interpreter";
export type { ExecutionOptions } from "./interpreter";
export { parseSource } from "./parser";
export { formatDisplayValue, formatValue } from "./format";
export { ARRAY_METHODS, Heap } from "./heap";

/** The program loaded into the editor on first launch. */
export const DEFAULT_CODE = `let x = 5;
let y = x + 2;
x = y * 3;
console.log(x);`;

/**
 * Run a source string end-to-end: parse → validate → interpret → snapshots.
 *
 * Never throws: parse and execution failures are both reported through the
 * returned `ExecutionResult`.
 *
 * @param source JavaScript source code restricted to the supported subset.
 * @param options Optional execution tuning (e.g. `maxSteps`).
 * @returns Either a full immutable timeline or a partial one plus an error.
 */
export function runCode(source: string, options: ExecutionOptions = {}): ExecutionResult {
  let program: Program;
  try {
    program = parseSource(source);
  } catch (err) {
    if (err instanceof CodeScopeError) {
      return {
        ok: false,
        error: err.toExecutionError(),
        snapshots: [createInitialSnapshot()],
      };
    }
    throw err;
  }
  return executeProgram(program, source, options);
}
