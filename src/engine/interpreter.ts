import type {
  BlockStatement,
  CallExpression,
  DoWhileStatement,
  Expression,
  ForStatement,
  FunctionDeclaration,
  IfStatement,
  MemberExpression,
  Node,
  Program,
  Statement,
  WhileStatement,
} from "@babel/types";
import { Environment } from "./environment";
import {
  evaluateExpression,
  isConsoleLog,
  SUPPORTED_BINARY_OPERATORS,
  SUPPORTED_LOGICAL_OPERATORS,
  SUPPORTED_UNARY_OPERATORS,
  toBoolean,
} from "./evaluate";
import { formatDisplayValue, formatValue } from "./format";
import { ARRAY_METHODS, Heap } from "./heap";
import { createInitialSnapshot, createSnapshot } from "./snapshot";
import {
  CodeScopeError,
  type BindingKind,
  type CallFrame,
  type ConsoleLine,
  type ExecutionResult,
  type RuntimeValue,
  type Snapshot,
} from "./types";

/** Node types the interpreter understands. Everything else is rejected up front. */
const SUPPORTED_NODE_TYPES: ReadonlySet<string> = new Set([
  "Program",
  "File",
  "Directive",
  "DirectiveLiteral",
  "EmptyStatement",
  "VariableDeclaration",
  "VariableDeclarator",
  "Identifier",
  "NumericLiteral",
  "StringLiteral",
  "BooleanLiteral",
  "NullLiteral",
  "UnaryExpression",
  "BinaryExpression",
  "LogicalExpression",
  "UpdateExpression",
  "AssignmentExpression",
  "ExpressionStatement",
  "CallExpression",
  "MemberExpression",
  "IfStatement",
  "BlockStatement",
  "ForStatement",
  "WhileStatement",
  "DoWhileStatement",
  "BreakStatement",
  "ContinueStatement",
  "FunctionDeclaration",
  "ReturnStatement",
  "ObjectExpression",
  "ObjectProperty",
  "ArrayExpression",
]);

type HasLoc = { loc?: { start?: { line?: number; column?: number } } | null };

/**
 * Internal control-flow signal for `break` / `continue` inside loops.
 * Not a `CodeScopeError`: the nearest enclosing loop catches it. The parser
 * rejects break/continue outside loops, so it never reaches the public API.
 */
class ControlFlowSignal {
  constructor(public readonly type: "break" | "continue") {}
}

/**
 * Internal control-flow signal for `return`. The currently executing frame's
 * `callFunction` catches it, records the value, and unwinds the frame.
 * Babel's parser rejects `return` outside a function, so it never leaks.
 */
class ReturnSignal {
  constructor(
    public readonly value: RuntimeValue,
    public readonly line: number,
  ) {}
}

/** A function as registered by the hoisting pre-pass. */
interface FunctionRecord {
  name: string;
  params: string[];
  body: BlockStatement;
  /** 1-based source line of the declaration (0 when unknown). */
  declaredAt: number;
}

/** Mutable state of one active call frame. */
interface FrameState {
  /** Stable id, unique across the whole timeline (React animation keys). */
  id: string;
  name: string;
  /** Environment scope index where this frame's locals begin. */
  scopeStart: number;
  /** 1-based source line the frame is currently stopped at. */
  line: number;
}

/** Options accepted by `executeProgram` / `runCode`. */
export interface ExecutionOptions {
  /** Maximum executed steps before execution aborts (default: MAX_EXECUTION_STEPS). */
  maxSteps?: number;
}

/** Default step budget; guards against infinite loops. */
export const MAX_EXECUTION_STEPS = 10_000;

/** Mutable bookkeeping shared across statement execution. */
interface ExecutionContext {
  steps: number;
  maxSteps: number;
}

/** Count one executed step, aborting with a runtime error past the budget. */
function tick(ctx: ExecutionContext): void {
  ctx.steps += 1;
  if (ctx.steps > ctx.maxSteps) {
    throw new CodeScopeError({
      kind: "runtime",
      message: `Execution stopped: exceeded the ${ctx.maxSteps} step limit (possible infinite loop or runaway recursion).`,
    });
  }
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function unsupported(nodeType: string, node: HasLoc): CodeScopeError {
  return new CodeScopeError({
    kind: "unsupported",
    message: "This syntax is not supported yet.",
    nodeType,
    line: node.loc?.start?.line,
    column: node.loc?.start?.column,
  });
}

/**
 * Validate that an entire program only uses the supported subset of
 * JavaScript. Runs before execution so a bad program fails fast with a
 * single, clear error instead of half-executing.
 */
function validateNode(node: Node): void {
  if (!SUPPORTED_NODE_TYPES.has(node.type)) {
    throw unsupported(node.type, node);
  }

  switch (node.type) {
    case "VariableDeclarator":
      if (node.id.type !== "Identifier") {
        // Destructuring / object patterns are not supported.
        throw unsupported("VariableDeclarator", node);
      }
      break;
    case "VariableDeclaration":
      if (node.kind !== "let" && node.kind !== "const" && node.kind !== "var") {
        throw unsupported("VariableDeclaration", node);
      }
      break;
    case "UnaryExpression":
      if (!SUPPORTED_UNARY_OPERATORS.has(node.operator)) {
        throw new CodeScopeError({
          kind: "unsupported",
          message: `This syntax is not supported yet. Unsupported operator "${node.operator}".`,
          nodeType: "UnaryExpression",
          line: node.loc?.start?.line,
          column: node.loc?.start?.column,
        });
      }
      break;
    case "BinaryExpression":
      if (!SUPPORTED_BINARY_OPERATORS.has(node.operator)) {
        throw new CodeScopeError({
          kind: "unsupported",
          message: `This syntax is not supported yet. Unsupported operator "${node.operator}".`,
          nodeType: "BinaryExpression",
          line: node.loc?.start?.line,
          column: node.loc?.start?.column,
        });
      }
      break;
    case "LogicalExpression":
      if (!SUPPORTED_LOGICAL_OPERATORS.has(node.operator)) {
        throw new CodeScopeError({
          kind: "unsupported",
          message: `This syntax is not supported yet. Unsupported operator "${node.operator}".`,
          nodeType: "LogicalExpression",
          line: node.loc?.start?.line,
          column: node.loc?.start?.column,
        });
      }
      break;
    case "UpdateExpression":
      if (node.operator !== "++" && node.operator !== "--") {
        throw new CodeScopeError({
          kind: "unsupported",
          message: `This syntax is not supported yet. Unsupported operator "${node.operator}".`,
          nodeType: "UpdateExpression",
          line: node.loc?.start?.line,
          column: node.loc?.start?.column,
        });
      }
      if (node.argument.type !== "Identifier") {
        throw unsupported("UpdateExpression", node);
      }
      break;
    case "BreakStatement":
    case "ContinueStatement":
      // Labeled break/continue are not supported.
      if (node.label) {
        throw unsupported(node.type, node);
      }
      break;
    case "AssignmentExpression":
      if (node.operator !== "=") {
        throw new CodeScopeError({
          kind: "unsupported",
          message: `This syntax is not supported yet. Unsupported operator "${node.operator}".`,
          nodeType: "AssignmentExpression",
          line: node.loc?.start?.line,
          column: node.loc?.start?.column,
        });
      }
      if (node.left.type !== "Identifier" && node.left.type !== "MemberExpression") {
        throw unsupported("AssignmentExpression", node);
      }
      break;
    case "CallExpression":
      // `console.log`, a user-defined function call, or an array-method call
      // (`arr.push(1)`). Anything else (e.g. `arr.map(...)`, `Math.max(...)`)
      // is not supported yet.
      if (isConsoleLog(node.callee as Expression)) break;
      if (node.callee.type === "Identifier") break;
      if (
        node.callee.type === "MemberExpression" &&
        !node.callee.computed &&
        node.callee.property.type === "Identifier" &&
        ARRAY_METHODS.has(node.callee.property.name)
      ) {
        break;
      }
      throw unsupported(node.callee.type, node);
      break;
    case "MemberExpression":
      // Member reads (dot and computed) on heap references are allowed;
      // `console.log` is allowed; property kinds that walk into unsupported
      // nodes (private names, optional chaining) are rejected by the walker.
      break;
    case "ObjectProperty":
      // Object literal methods, getters, and setters surface as ObjectMethod
      // nodes, which the walker rejects; plain data properties are fine.
      break;
  }
}

/** Recursively walk the AST, validating every node we touch. */
function walk(node: Node): void {
  validateNode(node);
  const record = node as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const child = record[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (isNode(item)) walk(item);
      }
    } else if (isNode(child)) {
      walk(child);
    }
  }
}

function assertSupportedProgram(program: Program): void {
  walk(program);
}

/** Statements that execute without producing a snapshot. */
function isNoOp(statement: Statement): boolean {
  return (
    statement.type === "EmptyStatement" ||
    statement.type === "FunctionDeclaration" ||
    (statement as Node).type === "Directive"
  );
}

interface ExecutionOutput {
  logs: ConsoleLine[];
  pushLog: (line: ConsoleLine) => void;
  /** Hoisted function declarations, resolved by name at call sites. */
  functions: Map<string, FunctionRecord>;
  /** Active call frames, innermost last. */
  frames: FrameState[];
  /** Monotonic id source so frame ids never repeat across the timeline. */
  nextFrameId: number;
  /** Runtime heap backing object/array literals and member access. */
  heap: Heap;
  /** Invoked by expression evaluation for user-defined function calls. */
  invoke: (name: string, args: readonly RuntimeValue[], node: CallExpression) => RuntimeValue;
}

/** Collect top-level function declarations (hoisted before execution begins). */
function collectFunctions(statements: Statement[]): Map<string, FunctionRecord> {
  const functions = new Map<string, FunctionRecord>();
  for (const statement of statements) {
    if (statement.type === "FunctionDeclaration") {
      const record = toFunctionRecord(statement);
      if (record) functions.set(record.name, record);
    }
  }
  return functions;
}

function toFunctionRecord(declaration: FunctionDeclaration): FunctionRecord | null {
  if (!declaration.id) return null;
  const params: string[] = [];
  for (const param of declaration.params) {
    if (param.type === "Identifier") params.push(param.name);
  }
  return {
    name: declaration.id.name,
    params,
    body: declaration.body,
    declaredAt: declaration.loc?.start?.line ?? 0,
  };
}

/** Recursively find every function declared inside a body (function scope hoisting). */
function findNestedDeclarations(body: BlockStatement): FunctionDeclaration[] {
  const found: FunctionDeclaration[] = [];
  const visit = (node: Node): void => {
    if (node.type === "FunctionDeclaration") {
      found.push(node);
      // A declaration's own body is a nested scope, not this one.
      return;
    }
    const record = node as unknown as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key === "loc" || key === "start" || key === "end" || key === "range" || key === "extra") continue;
      const child = record[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isNode(item)) visit(item);
        }
      } else if (isNode(child)) {
        visit(child);
      }
    }
  };
  for (const statement of body.body) {
    visit(statement);
  }
  return found;
}

/** Register nested declarations for a frame, restoring previous bindings on pop. */
function hoistNestedFunctions(
  functions: Map<string, FunctionRecord>,
  body: BlockStatement,
): Map<string, FunctionRecord | undefined> {
  const previous = new Map<string, FunctionRecord | undefined>();
  for (const declaration of findNestedDeclarations(body)) {
    const record = toFunctionRecord(declaration);
    if (!record) continue;
    const name = record.name;
    if (!previous.has(name)) previous.set(name, functions.get(name));
    functions.set(name, record);
  }
  return previous;
}

function restoreNestedFunctions(
  functions: Map<string, FunctionRecord>,
  previous: Map<string, FunctionRecord | undefined>,
): void {
  for (const [name, record] of previous) {
    if (record === undefined) functions.delete(name);
    else functions.set(name, record);
  }
}

/** Render an expression as source text (used when source slicing is unavailable). */
function expressionToString(node: Node): string {
  switch (node.type) {
    case "Identifier":
      return node.name;
    case "NumericLiteral":
      return String(node.value);
    case "StringLiteral":
      return JSON.stringify(node.value);
    case "BooleanLiteral":
      return String(node.value);
    case "NullLiteral":
      return "null";
    case "UnaryExpression":
      return `${node.operator}${expressionToString(node.argument as Expression)}`;
    case "BinaryExpression":
      return `${expressionToString(node.left as Expression)} ${node.operator} ${expressionToString(node.right as Expression)}`;
    case "LogicalExpression":
      return `${expressionToString(node.left as Expression)} ${node.operator} ${expressionToString(node.right as Expression)}`;
    case "UpdateExpression":
      return `${node.prefix ? node.operator : ""}${expressionToString(node.argument as Expression)}${node.prefix ? "" : node.operator}`;
    case "MemberExpression": {
      const objectText = expressionToString(node.object as Expression);
      if (node.computed) return `${objectText}[${expressionToString(node.property as Expression)}]`;
      return `${objectText}.${node.property.type === "Identifier" ? node.property.name : node.property.type}`;
    }
    case "ObjectExpression":
      return `{ ${node.properties
        .map((property) => expressionToString(property as unknown as Node))
        .join(", ")} }`;
    case "ObjectProperty": {
      const property = node as unknown as {
        key: { type: string; name?: string };
        value: Expression;
        computed: boolean;
      };
      const keyText = property.computed
        ? `[${expressionToString(property.key as unknown as Node)}]`
        : property.key.name ?? property.key.type;
      return `${keyText}: ${expressionToString(property.value)}`;
    }
    case "ArrayExpression":
      return `[${node.elements
        .map((element) => (element === null ? "" : expressionToString(element as Expression)))
        .join(", ")}]`;
    case "AssignmentExpression":
      return `${expressionToString(node.left as unknown as Node)} = ${expressionToString(node.right as Expression)}`;
    case "CallExpression": {
      const callee = node.callee;
      if (callee.type === "Identifier" && !isConsoleLog(callee)) {
        return `${callee.name}(${node.arguments
          .map((arg) => expressionToString(arg as Expression))
          .join(", ")})`;
      }
      if (callee.type === "MemberExpression") {
        return `${expressionToString(callee)}(${node.arguments
          .map((arg) => expressionToString(arg as Expression))
          .join(", ")})`;
      }
      return "console.log(...)";
    }
    default:
      return node.type;
  }
}

/**
 * Execute a single statement, mutating the shared environment and logs.
 * Called from the main loop after preflight validation has passed.
 *
 * Returns `true` when the statement produced its own snapshots (a bare call
 * to a user-defined function), so the caller skips its trailing snapshot.
 */
function executeStatement(
  env: Environment,
  output: ExecutionOutput,
  statement: Statement,
): boolean {
  switch (statement.type) {
    case "VariableDeclaration": {
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== "Identifier") {
          // Unreachable after preflight; kept for type safety.
          throw unsupported("VariableDeclarator", declaration);
        }
        const value = declaration.init
          ? evaluateExpression(env, declaration.init as Expression, output)
          : undefined;
        env.declare(declaration.id.name, statement.kind as BindingKind, value);
      }
      break;
    }
    case "ExpressionStatement": {
      const expression = statement.expression;
      const isUserCall =
        expression.type === "CallExpression" &&
        expression.callee.type === "Identifier" &&
        !isConsoleLog(expression.callee);
      evaluateExpression(env, expression, output);
      if (isUserCall) return true;
      break;
    }
    default:
      throw unsupported(statement.type, statement);
  }
  return false;
}

/** Loop construct identifiers, mirrored on loop snapshots. */
type LoopType = "for" | "while" | "do-while";

interface LoopMeta {
  loopType: LoopType;
  iteration: number;
}

/** Build an immutable view of the active call stack, innermost frame last. */
function buildCallStack(output: ExecutionOutput, env: Environment): readonly CallFrame[] {
  const frames = output.frames;
  const result: CallFrame[] = [];
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    const nextStart = i + 1 < frames.length ? frames[i + 1].scopeStart : env.scopeCount;
    result.push({
      id: frame.id,
      name: frame.name,
      line: frame.line,
      variables: env.frameVariables(frame.scopeStart, nextStart),
    });
  }
  return result;
}

/**
 * Record one immutable snapshot with the current call stack attached.
 *
 * Every snapshot inside a function carries the whole stack, so the UI can
 * animate frames pushing and popping as the user steps through time. The
 * current (top) frame's stored line is kept in sync with the snapshot line.
 */
function pushSnapshot(
  snapshots: Snapshot[],
  env: Environment,
  output: ExecutionOutput,
  line: number,
  description: string,
  extras?: {
    condition?: string;
    conditionResult?: boolean;
    loopType?: LoopType;
    iteration?: number;
  },
): void {
  const top = output.frames[output.frames.length - 1];
  if (top) top.line = line;
  snapshots.push(
    createSnapshot({
      index: snapshots.length,
      line,
      variables: env.snapshotVariables(),
      console: output.logs,
      description,
      callStack: buildCallStack(output, env),
      CurrentFrame: top ? top.id : undefined,
      heap: output.heap.size > 0 ? output.heap.snapshot() : undefined,
      ...(extras?.condition !== undefined ? { condition: extras.condition } : {}),
      ...(extras?.conditionResult !== undefined ? { conditionResult: extras.conditionResult } : {}),
      ...(extras?.loopType !== undefined ? { loopType: extras.loopType } : {}),
      ...(extras?.iteration !== undefined ? { iteration: extras.iteration } : {}),
    }),
  );
}

/**
 * Execute a statement and record one immutable snapshot for it.
 *
 * `IfStatement` is special-cased: it produces a *decision* snapshot (with the
 * evaluated condition and its boolean result) before running only the chosen
 * branch. Statements in branches that are not taken produce no snapshots.
 *
 * Loop statements (`For`/`While`/`DoWhile`) emit no snapshot of their own:
 * their iterations surface through per-step snapshots (init / condition /
 * body / update) carrying `loopType` + `iteration`.
 *
 * `meta` (loop context) is present when a statement runs inside a loop body.
 */
function executeStep(
  env: Environment,
  output: ExecutionOutput,
  statement: Statement,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  ctx: ExecutionContext,
  meta?: LoopMeta,
): void {
  if (isNoOp(statement)) return;

  tick(ctx);

  try {
    switch (statement.type) {
      case "IfStatement":
        executeIfStatement(env, output, statement, snapshots, sourceOf, ctx);
        return;
      case "ForStatement":
        executeForStatement(env, output, statement, snapshots, sourceOf, ctx);
        return;
      case "WhileStatement":
        executeWhileStatement(env, output, statement, snapshots, sourceOf, ctx);
        return;
      case "DoWhileStatement":
        executeDoWhileStatement(env, output, statement, snapshots, sourceOf, ctx);
        return;
      case "BreakStatement":
        throw new ControlFlowSignal("break");
      case "ContinueStatement":
        throw new ControlFlowSignal("continue");
      case "ReturnStatement":
        throw new ReturnSignal(
          statement.argument
            ? evaluateExpression(env, statement.argument as Expression, output)
            : undefined,
          statement.loc?.start?.line ?? 0,
        );
    }

    const logsBefore = output.logs.length;
    const emittedOwnSnapshots = executeStatement(env, output, statement);
    if (emittedOwnSnapshots) return;
    pushSnapshot(
      snapshots,
      env,
      output,
      statement.loc?.start?.line ?? 0,
      describeStatement(statement, env, output.logs.slice(logsBefore)),
      meta,
    );
  } catch (err) {
    if (err instanceof CodeScopeError) throw err.attachLocation(statement.loc?.start);
    throw err;
  }
}

/** Execute an `if` statement, emitting a decision snapshot, then its taken branch. */
function executeIfStatement(
  env: Environment,
  output: ExecutionOutput,
  statement: IfStatement,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  ctx: ExecutionContext,
): void {
  const result = evaluateExpression(env, statement.test, output);
  const conditionResult = toBoolean(result);
  const conditionText = sourceOf(statement.test);

  pushSnapshot(
    snapshots,
    env,
    output,
    statement.loc?.start?.line ?? 0,
    `Condition evaluated: ${conditionText} → ${formatValue(result)}`,
    { condition: conditionText, conditionResult },
  );

  const branch = conditionResult ? statement.consequent : statement.alternate;
  if (branch) executeBranch(env, output, branch, snapshots, sourceOf, ctx);
}

/** Run the statements of a chosen branch (a block or a single statement). */
function executeBranch(
  env: Environment,
  output: ExecutionOutput,
  node: Statement,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  ctx: ExecutionContext,
): void {
  env.pushScope();
  try {
    const statements = node.type === "BlockStatement" ? node.body : [node];
    for (const statement of statements) {
      executeStep(env, output, statement, snapshots, sourceOf, ctx);
    }
  } finally {
    env.popScope();
  }
}

/** Evaluate a loop condition and emit its decision snapshot. */
function emitLoopCondition(
  env: Environment,
  output: ExecutionOutput,
  test: Expression,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  meta: LoopMeta,
): boolean {
  const result = evaluateExpression(env, test, output);
  const conditionResult = toBoolean(result);
  const conditionText = sourceOf(test);

  pushSnapshot(
    snapshots,
    env,
    output,
    test.loc?.start?.line ?? 0,
    `Condition evaluated: ${conditionText} → ${formatValue(result)}`,
    { condition: conditionText, conditionResult, ...meta },
  );
  return conditionResult;
}

/** Execute a loop expression (init or update), emitting one snapshot. */
function executeLoopExpression(
  env: Environment,
  output: ExecutionOutput,
  node: Expression,
  snapshots: Snapshot[],
  meta: LoopMeta,
  ctx: ExecutionContext,
): void {
  tick(ctx);
  const logsBefore = output.logs.length;
  evaluateExpression(env, node, output);
  const producedLogs = output.logs.slice(logsBefore);

  pushSnapshot(
    snapshots,
    env,
    output,
    node.loc?.start?.line ?? 0,
    describeLoopExpression(env, node, producedLogs),
    meta,
  );
}

/**
 * Run a loop body, translating `break`/`continue` signals for the caller.
 * Each iteration runs in a fresh scope so `let`/`const` in the body are
 * created anew every iteration (matching JavaScript).
 */
function runLoopBody(
  env: Environment,
  output: ExecutionOutput,
  body: Statement,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  meta: LoopMeta,
  ctx: ExecutionContext,
): "normal" | "break" {
  env.pushScope();
  try {
    const statements = body.type === "BlockStatement" ? body.body : [body];
    for (const statement of statements) {
      try {
        executeStep(env, output, statement, snapshots, sourceOf, ctx, meta);
      } catch (err) {
        if (err instanceof ControlFlowSignal) {
          // `break` exits the loop; `continue` stops this iteration's body so
          // the loop proceeds to its update/condition step.
          return err.type === "break" ? "break" : "normal";
        }
        throw err;
      }
    }
    return "normal";
  } finally {
    env.popScope();
  }
}

/**
 * Execute a `for` loop: init → condition → body → update → repeat. The final
 * failed condition also produces a snapshot (iteration n + 1).
 *
 * The whole statement runs in a scope of its own so `let`/`const` declared
 * in the init live only for the loop (fresh per statement execution).
 */
function executeForStatement(
  env: Environment,
  output: ExecutionOutput,
  statement: ForStatement,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  ctx: ExecutionContext,
): void {
  env.pushScope();
  try {
    let iteration = 1;
    const meta = (): LoopMeta => ({ loopType: "for", iteration });

    if (statement.init) {
      if (statement.init.type === "VariableDeclaration") {
        executeStep(env, output, statement.init, snapshots, sourceOf, ctx, meta());
      } else {
        executeLoopExpression(env, output, statement.init as Expression, snapshots, meta(), ctx);
      }
    }

    while (true) {
      tick(ctx);
      // A missing test means "always true" in JavaScript (`for (;;)`).
      const passed = statement.test
        ? emitLoopCondition(env, output, statement.test, snapshots, sourceOf, meta())
        : true;
      if (!passed) break;

      const bodyResult = runLoopBody(env, output, statement.body, snapshots, sourceOf, meta(), ctx);
      if (bodyResult === "break") break;

      if (statement.update) {
        executeLoopExpression(env, output, statement.update as Expression, snapshots, meta(), ctx);
      }

      iteration += 1;
    }
  } finally {
    env.popScope();
  }
}

/** Execute a `while` loop: condition → body → repeat. */
function executeWhileStatement(
  env: Environment,
  output: ExecutionOutput,
  statement: WhileStatement,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  ctx: ExecutionContext,
): void {
  let iteration = 1;
  while (true) {
    tick(ctx);
    const passed = emitLoopCondition(
      env,
      output,
      statement.test,
      snapshots,
      sourceOf,
      { loopType: "while", iteration },
    );
    if (!passed) break;

    const bodyResult = runLoopBody(
      env,
      output,
      statement.body,
      snapshots,
      sourceOf,
      { loopType: "while", iteration },
      ctx,
    );
    if (bodyResult === "break") break;

    iteration += 1;
  }
}

/** Execute a `do...while` loop: body → condition → repeat. */
function executeDoWhileStatement(
  env: Environment,
  output: ExecutionOutput,
  statement: DoWhileStatement,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  ctx: ExecutionContext,
): void {
  let iteration = 1;
  while (true) {
    tick(ctx);
    const bodyResult = runLoopBody(
      env,
      output,
      statement.body,
      snapshots,
      sourceOf,
      { loopType: "do-while", iteration },
      ctx,
    );
    if (bodyResult === "break") break;

    const passed = emitLoopCondition(
      env,
      output,
      statement.test,
      snapshots,
      sourceOf,
      { loopType: "do-while", iteration },
    );
    if (!passed) break;

    iteration += 1;
  }
}

/**
 * Invoke a user-defined function.
 *
 * Runs the whole call synchronously: pushes a frame, binds parameters in a
 * fresh scope, executes the body statement by statement (emitting a snapshot
 * for each), captures the return value, then pops the frame. Every snapshot
 * emitted while the frame is live carries the full call stack, so recursion
 * and nesting are visible on the timeline.
 */
function callFunction(
  env: Environment,
  output: ExecutionOutput,
  name: string,
  args: readonly RuntimeValue[],
  node: CallExpression,
  snapshots: Snapshot[],
  sourceOf: (node: Node) => string,
  ctx: ExecutionContext,
): RuntimeValue {
  const fn = output.functions.get(name);
  if (!fn) {
    // `eval` / `Function` are JS globals we deliberately never provide.
    if (name === "eval" || name === "Function") {
      throw new CodeScopeError({
        kind: "unsupported",
        message: "This syntax is not supported yet.",
        nodeType: "CallExpression",
        line: node.loc?.start?.line,
        column: node.loc?.start?.column,
      });
    }
    throw new CodeScopeError({
      kind: "runtime",
      message: `${name} is not defined.`,
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }

  // The caller's frame now waits at the call site.
  const caller = output.frames[output.frames.length - 1];
  const callLine = node.loc?.start?.line ?? fn.declaredAt;
  if (caller) caller.line = callLine;

  tick(ctx);

  const scopeStart = env.pushFrameScope();
  output.frames.push({
    id: `frame-${++output.nextFrameId}`,
    name,
    scopeStart,
    line: fn.declaredAt,
  });
  const frame = output.frames[output.frames.length - 1];
  const nested = hoistNestedFunctions(output.functions, fn.body);

  try {
    pushSnapshot(
      snapshots,
      env,
      output,
      fn.declaredAt,
      `Entering function ${name}`,
    );

    // Bind parameters. Missing arguments become `undefined` (JS behavior);
    // extra arguments are ignored.
    fn.params.forEach((param, index) => {
      tick(ctx);
      env.declare(param, "let", index < args.length ? args[index] : undefined);
      pushSnapshot(
        snapshots,
        env,
        output,
        fn.declaredAt,
        `Parameter ${param} = ${formatValue(index < args.length ? args[index] : undefined)}`,
      );
    });

    let returnValue: RuntimeValue = undefined;
    let returnLine = frame.line;
    try {
      for (const statement of fn.body.body) {
        executeStep(env, output, statement, snapshots, sourceOf, ctx);
      }
    } catch (err) {
      if (err instanceof ReturnSignal) {
        returnValue = err.value;
        returnLine = err.line;
        pushSnapshot(
          snapshots,
          env,
          output,
          err.line,
          `Returning value ${formatValue(returnValue)}`,
        );
      } else {
        throw err;
      }
    }

    env.popFrameScope(scopeStart);
    output.frames.pop();
    restoreNestedFunctions(output.functions, nested);
    snapshots.push(
      createSnapshot({
        index: snapshots.length,
        line: returnLine,
        variables: env.snapshotVariables(),
        console: output.logs,
        description: `Leaving function ${name}`,
        callStack: buildCallStack(output, env),
        CurrentFrame: output.frames[output.frames.length - 1]?.id,
        heap: output.heap.size > 0 ? output.heap.snapshot() : undefined,
      }),
    );

    return returnValue;
  } catch (err) {
    // Errors unwind the frame so the partial timeline stays consistent.
    env.popFrameScope(scopeStart);
    if (output.frames[output.frames.length - 1] === frame) {
      output.frames.pop();
    }
    restoreNestedFunctions(output.functions, nested);
    throw err;
  }
}

/** Human-readable description of the statement that just executed. */
function describeStatement(
  statement: Statement,
  env: Environment,
  producedLogs: ConsoleLine[],
): string {
  switch (statement.type) {
    case "VariableDeclaration": {
      const parts = statement.declarations.map((declaration) => {
        if (declaration.id.type !== "Identifier") return "";
        const value = env.read(declaration.id.name);
        return `\`${declaration.id.name}\` = ${formatDisplayValue(value)}`;
      });
      return `Declared ${parts.join(", ")}.`;
    }
    case "ExpressionStatement": {
      const expression = statement.expression;
      if (expression.type === "AssignmentExpression" && expression.left.type === "MemberExpression") {
        const path = memberPath(expression.left);
        return `Assigned \`${path}\` = ${expressionToString(expression.right as Expression)}.`;
      }
      if (expression.type === "AssignmentExpression" && expression.left.type === "Identifier") {
        const value = env.read(expression.left.name);
        return `Assigned \`${expression.left.name}\` = ${formatDisplayValue(value)}.`;
      }
      if (expression.type === "UpdateExpression" && expression.argument.type === "Identifier") {
        const value = env.read(expression.argument.name);
        const verb = expression.operator === "++" ? "Incremented" : "Decremented";
        return `${verb} \`${expression.argument.name}\` = ${formatDisplayValue(value)}.`;
      }
      if (expression.type === "CallExpression") {
        if (expression.callee.type === "MemberExpression") {
          return `Invoked \`${expressionToString(expression.callee)}\` with ${expression.arguments.length} argument(s).`;
        }
        return `Logged ${producedLogs.join(" ")}.`;
      }
      return "Evaluated an expression with no side effect.";
    }
    default:
      return "Executed a statement.";
  }
}

/** Compact path for a member expression target, e.g. `arr[0]` or `user.name`. */
function memberPath(node: MemberExpression): string {
  const objectText = node.object.type === "Identifier" ? node.object.name : expressionToString(node.object as Expression);
  if (node.computed) return `${objectText}[${expressionToString(node.property as Expression)}]`;
  return `${objectText}.${node.property.type === "Identifier" ? node.property.name : "?"}`;
}

/** Description for a loop init/update expression (no snapshot of its own). */
function describeLoopExpression(
  env: Environment,
  expression: Expression,
  producedLogs: ConsoleLine[],
): string {
  if (expression.type === "UpdateExpression" && expression.argument.type === "Identifier") {
    const value = env.read(expression.argument.name);
    const verb = expression.operator === "++" ? "Incremented" : "Decremented";
    return `${verb} \`${expression.argument.name}\` = ${formatDisplayValue(value)}.`;
  }
  if (expression.type === "AssignmentExpression" && expression.left.type === "Identifier") {
    const value = env.read(expression.left.name);
    return `Assigned \`${expression.left.name}\` = ${formatDisplayValue(value)}.`;
  }
  if (expression.type === "AssignmentExpression" && expression.left.type === "MemberExpression") {
    return `Assigned \`${memberPath(expression.left)}\` = ${expressionToString(expression.right as Expression)}.`;
  }
  if (expression.type === "CallExpression") {
    return `Logged ${producedLogs.join(" ")}.`;
  }
  return "Evaluated a loop expression with no side effect.";
}

/**
 * Walk and execute a parsed program, producing one immutable snapshot per
 * executed statement (plus an initial snapshot).
 *
 * Never throws: failures are reported as an `ExecutionResult` with the
 * partial timeline so the UI can show exactly where execution broke.
 */
export function executeProgram(
  program: Program,
  sourceCode = "",
  options: ExecutionOptions = {},
): ExecutionResult {
  const env = new Environment();
  const output: ExecutionOutput = {
    logs: [],
    pushLog: (line) => output.logs.push(line),
    functions: collectFunctions(program.body),
    frames: [],
    nextFrameId: 0,
    heap: new Heap(),
    invoke: (name, args, node) =>
      callFunction(env, output, name, args, node, snapshots, sourceOf, ctx),
  };
  const snapshots: Snapshot[] = [createInitialSnapshot()];
  const ctx: ExecutionContext = { steps: 0, maxSteps: options.maxSteps ?? MAX_EXECUTION_STEPS };

  // Prefer the exact source text for descriptions; fall back to a renderer.
  const sourceOf = (node: Node): string => {
    if (sourceCode && node.start != null && node.end != null) {
      const text = sourceCode.slice(node.start, node.end).trim();
      if (text) return text;
    }
    return expressionToString(node);
  };

  try {
    assertSupportedProgram(program);

    for (const statement of program.body) {
      executeStep(env, output, statement, snapshots, sourceOf, ctx);
    }

    return { ok: true, snapshots };
  } catch (err) {
    if (err instanceof CodeScopeError) {
      return { ok: false, error: err.toExecutionError(), snapshots };
    }
    // Deep recursion can exhaust the real JS stack before our step budget.
    // Report it as a friendly runtime error instead of a raw crash.
    if (err instanceof RangeError) {
      return {
        ok: false,
        error: { kind: "runtime", message: "Maximum call stack depth exceeded." },
        snapshots,
      };
    }
    // Unknown interpreter bug (including a stray control-flow signal) —
    // never crash the app with a raw exception.
    return {
      ok: false,
      error: { kind: "runtime", message: "Unexpected interpreter error." },
      snapshots,
    };
  }
}

// Re-exported for the public API; kept out of the way of the implementation.
export type { RuntimeValue };
