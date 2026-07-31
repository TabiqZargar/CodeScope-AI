import type {
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  MemberExpression,
  UnaryExpression,
} from "@babel/types";
import { Environment } from "./environment";
import { formatValue } from "./format";
import { CodeScopeError, type RuntimeValue } from "./types";

/** Callback contract used by expression evaluation to capture console output. */
export interface OutputSink {
  pushLog: (formatted: string) => void;
}

/** Binary operators the interpreter understands (subset of JavaScript). */
export const SUPPORTED_BINARY_OPERATORS: ReadonlySet<string> = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  ">",
  "<",
  ">=",
  "<=",
  "==",
  "===",
  "!=",
  "!==",
]);

/** Unary operators the interpreter understands. */
export const SUPPORTED_UNARY_OPERATORS: ReadonlySet<string> = new Set(["-", "!"]);

/** True when `node` is the `console.log` member expression. */
export function isConsoleLog(node: Expression): node is MemberExpression {
  return (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.object.name === "console" &&
    node.property.type === "Identifier" &&
    node.property.name === "log"
  );
}

/** Type for nodes that carry source locations. */
type HasLoc = { loc?: { start?: { line?: number; column?: number } } | null };

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
 * Evaluate an expression node into a runtime value.
 *
 * Pure with respect to snapshots: the only side effects it may cause are
 * captured `console.log` output (via `sink`) and environment writes for
 * assignment expressions.
 */
export function evaluateExpression(
  env: Environment,
  node: Expression,
  sink: OutputSink,
): RuntimeValue {
  switch (node.type) {
    case "NumericLiteral":
      return node.value;
    case "StringLiteral":
      return node.value;
    case "BooleanLiteral":
      return node.value;
    case "NullLiteral":
      return null;
    case "Identifier":
      return evaluateIdentifier(env, node.name, node);
    case "UnaryExpression":
      return evaluateUnary(env, node, sink);
    case "BinaryExpression":
      return evaluateBinary(env, node, sink);
    case "AssignmentExpression":
      return evaluateAssignment(env, node, sink);
    case "CallExpression":
      return evaluateCall(env, node, sink);
    default:
      throw unsupported(node.type, node);
  }
}

function evaluateIdentifier(env: Environment, name: string, node: HasLoc): RuntimeValue {
  // Built-in globals that behave like JS.
  if (name === "undefined") return undefined;
  if (name === "NaN") return NaN;
  if (name === "Infinity") return Infinity;

  if (!env.has(name)) {
    throw new CodeScopeError({
      kind: "runtime",
      message: `${name} is not defined.`,
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }
  return env.read(name);
}

function evaluateUnary(env: Environment, node: UnaryExpression, sink: OutputSink): RuntimeValue {
  const value = evaluateExpression(env, node.argument as Expression, sink);
  switch (node.operator) {
    case "-":
      return -toNumber(value);
    case "!":
      return !toBoolean(value);
    default:
      throw unsupported("UnaryExpression", node);
  }
}

function evaluateBinary(env: Environment, node: BinaryExpression, sink: OutputSink): RuntimeValue {
  const left = evaluateExpression(env, node.left as Expression, sink);
  const right = evaluateExpression(env, node.right as Expression, sink);

  if (!SUPPORTED_BINARY_OPERATORS.has(node.operator)) {
    throw new CodeScopeError({
      kind: "unsupported",
      message: `This syntax is not supported yet. Unsupported operator "${node.operator}".`,
      nodeType: "BinaryExpression",
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }

  return applyBinaryOperator(node.operator, left, right);
}

function evaluateAssignment(
  env: Environment,
  node: AssignmentExpression,
  sink: OutputSink,
): RuntimeValue {
  if (node.operator !== "=") {
    throw new CodeScopeError({
      kind: "unsupported",
      message: `This syntax is not supported yet. Unsupported operator "${node.operator}".`,
      nodeType: "AssignmentExpression",
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }
  if (node.left.type !== "Identifier") {
    throw unsupported("AssignmentExpression", node);
  }

  const value = evaluateExpression(env, node.right as Expression, sink);

  if (!env.has(node.left.name)) {
    throw new CodeScopeError({
      kind: "runtime",
      message: `${node.left.name} is not defined.`,
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }

  env.assign(node.left.name, value);
  return value;
}

function evaluateCall(env: Environment, node: CallExpression, sink: OutputSink): RuntimeValue {
  if (!isConsoleLog(node.callee as Expression)) {
    throw new CodeScopeError({
      kind: "unsupported",
      message: "This syntax is not supported yet.",
      nodeType: "CallExpression",
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }

  const parts: string[] = [];
  for (const arg of node.arguments) {
    if (arg.type === "SpreadElement" || arg.type === "ArgumentPlaceholder") {
      throw new CodeScopeError({
        kind: "unsupported",
        message: "This syntax is not supported yet.",
        nodeType: arg.type,
        line: arg.loc?.start?.line,
        column: arg.loc?.start?.column,
      });
    }
    const value = evaluateExpression(env, arg as Expression, sink);
    parts.push(formatValue(value));
  }

  sink.pushLog(parts.join(" "));
  return undefined;
}

// ---------------------------------------------------------------------------
// Operator semantics (subset of ECMAScript coercion rules)
// ---------------------------------------------------------------------------

function applyBinaryOperator(op: string, left: RuntimeValue, right: RuntimeValue): RuntimeValue {
  switch (op) {
    case "+":
      // JS: if either side is a string, concatenate.
      if (typeof left === "string" || typeof right === "string") {
        return String(left) + String(right);
      }
      return toNumber(left) + toNumber(right);
    case "-":
      return toNumber(left) - toNumber(right);
    case "*":
      return toNumber(left) * toNumber(right);
    case "/":
      return toNumber(left) / toNumber(right);
    case "%":
      return toNumber(left) % toNumber(right);
    case ">":
      return compare(left, right) > 0;
    case "<":
      return compare(left, right) < 0;
    case ">=":
      return compare(left, right) >= 0;
    case "<=":
      return compare(left, right) <= 0;
    case "==":
      return looseEquals(left, right);
    case "!=":
      return !looseEquals(left, right);
    case "===":
      return strictEquals(left, right);
    case "!==":
      return !strictEquals(left, right);
    default:
      // Unreachable (pre-validated), kept as a safety net.
      throw new CodeScopeError({
        kind: "unsupported",
        message: `This syntax is not supported yet. Unsupported operator "${op}".`,
        nodeType: "BinaryExpression",
      });
  }
}

/** `Number()`-style coercion used by arithmetic and relational operators. */
function toNumber(value: RuntimeValue): number {
  switch (typeof value) {
    case "number":
      return value;
    case "boolean":
      return value ? 1 : 0;
    case "string":
      return Number(value);
    case "undefined":
      return NaN;
    case "object": // null
      return 0;
  }
}

/** JS truthiness. */
function toBoolean(value: RuntimeValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  return value; // boolean
}

/**
 * Relational comparison. Returns a negative/zero/positive number or NaN,
 * mirroring the ECMAScript `<` / `>` algorithm closely enough for primitives.
 */
function compare(left: RuntimeValue, right: RuntimeValue): number {
  if (typeof left === "string" && typeof right === "string") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  const l = toNumber(left);
  const r = toNumber(right);
  if (Number.isNaN(l) || Number.isNaN(r)) return NaN;
  return l < r ? -1 : l > r ? 1 : 0;
}

/** Loose equality (`==`) for primitive values. */
function looseEquals(left: RuntimeValue, right: RuntimeValue): boolean {
  if (left == null) return right == null;
  if (typeof left === "boolean" || typeof right === "boolean") {
    return toNumber(left) === toNumber(right);
  }
  if (typeof left === "number" && typeof right === "string") {
    return left === toNumber(right);
  }
  if (typeof left === "string" && typeof right === "number") {
    return toNumber(left) === right;
  }
  return strictEquals(left, right);
}

/** Strict equality (`===`); `NaN !== NaN`, matching JavaScript. */
function strictEquals(left: RuntimeValue, right: RuntimeValue): boolean {
  return left === right;
}
