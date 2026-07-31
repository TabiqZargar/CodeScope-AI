import type {
  ArrayExpression,
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  LogicalExpression,
  MemberExpression,
  ObjectExpression,
  PrivateName,
  UnaryExpression,
  UpdateExpression,
} from "@babel/types";
import { Environment } from "./environment";
import { formatValue } from "./format";
import { ARRAY_METHODS, Heap } from "./heap";
import { CodeScopeError, isHeapReference, type RuntimeValue } from "./types";

/**
 * Callback contract used by expression evaluation.
 *
 * `pushLog` captures `console.log` output. `invoke` is provided by the
 * interpreter so a `CallExpression` whose callee is a user-defined function
 * can hand control back to the execution engine (which pushes a frame,
 * runs the body, and returns the result). It is optional here so the
 * evaluator stays usable in isolation. `heap` is where object/array
 * literals allocate nodes and member expressions read/write them.
 */
export interface OutputSink {
  pushLog: (formatted: string) => void;
  invoke?: (name: string, args: readonly RuntimeValue[], node: CallExpression) => RuntimeValue;
  heap: Heap;
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

/** Logical (short-circuiting) operators the interpreter understands. */
export const SUPPORTED_LOGICAL_OPERATORS: ReadonlySet<string> = new Set(["&&", "||"]);

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
    case "LogicalExpression":
      return evaluateLogical(env, node, sink);
    case "UpdateExpression":
      return evaluateUpdate(env, node);
    case "AssignmentExpression":
      return evaluateAssignment(env, node, sink);
    case "CallExpression":
      return evaluateCall(env, node, sink);
    case "ObjectExpression":
      return evaluateObjectLiteral(env, node, sink);
    case "ArrayExpression":
      return evaluateArrayLiteral(env, node, sink);
    case "MemberExpression":
      return evaluateMemberRead(env, node, sink);
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

function evaluateLogical(
  env: Environment,
  node: LogicalExpression,
  sink: OutputSink,
): RuntimeValue {
  if (!SUPPORTED_LOGICAL_OPERATORS.has(node.operator)) {
    throw new CodeScopeError({
      kind: "unsupported",
      message: `This syntax is not supported yet. Unsupported operator "${node.operator}".`,
      nodeType: "LogicalExpression",
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }

  const left = evaluateExpression(env, node.left as Expression, sink);
  // Short-circuit: only evaluate the right side when necessary.
  if (node.operator === "&&") {
    return toBoolean(left) ? evaluateExpression(env, node.right as Expression, sink) : left;
  }
  return toBoolean(left) ? left : evaluateExpression(env, node.right as Expression, sink);
}

/** Evaluate `++` / `--`, mirroring JS prefix/postfix semantics. */
function evaluateUpdate(env: Environment, node: UpdateExpression): RuntimeValue {
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
  if (!env.has(node.argument.name)) {
    throw new CodeScopeError({
      kind: "runtime",
      message: `${node.argument.name} is not defined.`,
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }

  const oldValue = env.read(node.argument.name);
  const delta = node.operator === "++" ? 1 : -1;
  const newValue = toNumber(oldValue) + delta;
  env.assign(node.argument.name, newValue);
  return node.prefix ? newValue : oldValue;
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
  if (node.left.type !== "Identifier" && node.left.type !== "MemberExpression") {
    throw unsupported("AssignmentExpression", node);
  }

  const value = evaluateExpression(env, node.right as Expression, sink);

  if (node.left.type === "MemberExpression") {
    writeMember(env, node.left, value, sink);
    return value;
  }

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
  if (isConsoleLog(node.callee as Expression)) {
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

  // User-defined function call: delegate to the interpreter's call machinery.
  if (node.callee.type === "Identifier") {
    if (!sink.invoke) {
      throw unsupported("CallExpression", node);
    }
    const args: RuntimeValue[] = [];
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
      args.push(evaluateExpression(env, arg as Expression, sink));
    }
    return sink.invoke(node.callee.name, args, node);
  }

  // Array method call (e.g. `arr.push(1)`): requires a member callee.
  if (node.callee.type === "MemberExpression") {
    return evaluateMemberCall(env, node.callee, node, sink);
  }

  throw new CodeScopeError({
    kind: "unsupported",
    message: "This syntax is not supported yet.",
    nodeType: node.callee.type,
    line: node.loc?.start?.line,
    column: node.loc?.start?.column,
  });
}

// ---------------------------------------------------------------------------
// Heap literals, member access, and array methods
// ---------------------------------------------------------------------------

/** Evaluate an object literal into a fresh heap node, returning its reference. */
function evaluateObjectLiteral(
  env: Environment,
  node: ObjectExpression,
  sink: OutputSink,
): RuntimeValue {
  const properties: Record<string, RuntimeValue> = {};
  for (const property of node.properties) {
    if (property.type !== "ObjectProperty") {
      throw new CodeScopeError({
        kind: "unsupported",
        message: "This syntax is not supported yet.",
        nodeType: property.type,
        line: property.loc?.start?.line,
        column: property.loc?.start?.column,
      });
    }
    const key = propertyKey(env, property, sink);
    if (key === undefined) {
      throw new CodeScopeError({
        kind: "unsupported",
        message: "This syntax is not supported yet.",
        nodeType: property.key.type,
        line: property.key.loc?.start?.line,
        column: property.key.loc?.start?.column,
      });
    }
    const value = evaluateExpression(env, property.value as Expression, sink);
    properties[key] = value;
  }
  return sink.heap.allocateObject(properties);
}

/** Evaluate an array literal into a fresh heap node, returning its reference. */
function evaluateArrayLiteral(env: Environment, node: ArrayExpression, sink: OutputSink): RuntimeValue {
  const elements: RuntimeValue[] = [];
  for (const element of node.elements) {
    if (element === null) {
      elements.push(undefined); // Array holes read as `undefined`, like JS.
    } else if (element.type === "SpreadElement") {
      throw new CodeScopeError({
        kind: "unsupported",
        message: "This syntax is not supported yet.",
        nodeType: element.type,
        line: element.loc?.start?.line,
        column: element.loc?.start?.column,
      });
    } else {
      elements.push(evaluateExpression(env, element, sink));
    }
  }
  return sink.heap.allocateArray(elements);
}

/** Read a member expression: dot or computed access on an object/array ref. */
function evaluateMemberRead(env: Environment, node: MemberExpression, sink: OutputSink): RuntimeValue {
  const target = evaluateExpression(env, node.object as Expression, sink);
  if (!isHeapReference(target)) {
    throw new CodeScopeError({
      kind: "runtime",
      message: "Cannot read properties of a non-object value.",
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }
  const key = memberKey(env, node, sink);
  return sink.heap.get(target, key);
}

/** Write a member expression target: `obj.x = v` / `arr[i] = v`. */
function writeMember(
  env: Environment,
  node: MemberExpression,
  value: RuntimeValue,
  sink: OutputSink,
): void {
  const target = evaluateExpression(env, node.object as Expression, sink);
  if (!isHeapReference(target)) {
    throw new CodeScopeError({
      kind: "runtime",
      message: "Cannot set properties of a non-object value.",
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }
  const key = memberKey(env, node, sink);
  sink.heap.set(target, key, value);
}

/** Dispatch supported array methods (`push`, `pop`, `shift`, `unshift`). */
function evaluateMemberCall(
  env: Environment,
  callee: MemberExpression,
  node: CallExpression,
  sink: OutputSink,
): RuntimeValue {
  if (callee.computed || callee.property.type !== "Identifier" || !ARRAY_METHODS.has(callee.property.name)) {
    throw new CodeScopeError({
      kind: "unsupported",
      message: "This syntax is not supported yet.",
      nodeType: "MemberExpression",
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }

  const target = evaluateExpression(env, callee.object as Expression, sink);
  if (!isHeapReference(target)) {
    throw new CodeScopeError({
      kind: "runtime",
      message: `${callee.property.name} is not a function.`,
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }

  const method = callee.property.name;
  const args: RuntimeValue[] = [];
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
    args.push(evaluateExpression(env, arg as Expression, sink));
  }

  switch (method) {
    case "push":
      return sink.heap.push(target, args);
    case "pop":
      return sink.heap.pop(target);
    case "shift":
      return sink.heap.shift(target);
    case "unshift":
      return sink.heap.unshift(target, args);
    default:
      throw unsupported("MemberExpression", callee);
  }
}

/**
 * Resolve a member's key. Dot access (`obj.name`) uses the literal property
 * name; computed access (`obj[key]`) evaluates the key expression.
 */
function memberKey(env: Environment, node: MemberExpression, sink: OutputSink): number | string {
  if (node.computed) {
    const keyValue = evaluateExpression(env, node.property as Expression, sink);
    if (typeof keyValue === "number") return keyValue;
    if (typeof keyValue === "string") return keyValue;
    throw new CodeScopeError({
      kind: "runtime",
      message: "Invalid property access.",
      line: node.loc?.start?.line,
      column: node.loc?.start?.column,
    });
  }
  if (node.property.type === "Identifier") return node.property.name;
  throw new CodeScopeError({
    kind: "unsupported",
    message: "This syntax is not supported yet.",
    nodeType: node.property.type,
    line: node.loc?.start?.line,
    column: node.loc?.start?.column,
  });
}

/**
 * Resolve an object-literal property key. Non-computed keys must be
 * identifier-like; computed keys evaluate to a runtime value and are
 * coerced to a string (JS semantics for `{ [expr]: v }`).
 */
function propertyKey(
  env: Environment,
  property: { key: Expression | PrivateName; computed: boolean },
  sink: OutputSink,
): string | undefined {
  if (property.computed) {
    const keyValue = evaluateExpression(env, property.key as Expression, sink);
    if (typeof keyValue === "number" || typeof keyValue === "string") return String(keyValue);
    return undefined;
  }
  const key = property.key;
  if (key.type === "Identifier") return key.name;
  if (key.type === "StringLiteral" || key.type === "NumericLiteral") return String(key.value);
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

/** JS truthiness; heap references are always truthy (like objects). */
export function toBoolean(value: RuntimeValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  return true; // heap reference
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
