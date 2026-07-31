import type { Expression, Node, Program, Statement } from "@babel/types";
import { Environment } from "./environment";
import { evaluateExpression, isConsoleLog, SUPPORTED_BINARY_OPERATORS, SUPPORTED_UNARY_OPERATORS } from "./evaluate";
import { formatDisplayValue } from "./format";
import { createInitialSnapshot, createSnapshot } from "./snapshot";
import { CodeScopeError, type BindingKind, type ConsoleLine, type ExecutionResult, type RuntimeValue, type Snapshot } from "./types";

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
  "AssignmentExpression",
  "ExpressionStatement",
  "CallExpression",
  "MemberExpression",
]);

type HasLoc = { loc?: { start?: { line?: number; column?: number } } | null };

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
      if (node.left.type !== "Identifier") {
        throw unsupported("AssignmentExpression", node);
      }
      break;
    case "CallExpression":
      if (!isConsoleLog(node.callee as Expression)) {
        throw unsupported(node.callee.type, node);
      }
      break;
    case "MemberExpression":
      // Bare member access is not supported; only `console.log` is allowed,
      // and it is validated through its parent CallExpression.
      if (!isConsoleLog(node)) {
        throw unsupported("MemberExpression", node);
      }
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
  return statement.type === "EmptyStatement" || (statement as Node).type === "Directive";
}

interface ExecutionOutput {
  logs: ConsoleLine[];
  pushLog: (line: ConsoleLine) => void;
}

/**
 * Execute a single statement, mutating the shared environment and logs.
 * Called from the main loop after preflight validation has passed.
 */
function executeStatement(env: Environment, output: ExecutionOutput, statement: Statement): void {
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
    case "ExpressionStatement":
      evaluateExpression(env, statement.expression, output);
      break;
    default:
      throw unsupported(statement.type, statement);
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
      if (expression.type === "AssignmentExpression" && expression.left.type === "Identifier") {
        const value = env.read(expression.left.name);
        return `Assigned \`${expression.left.name}\` = ${formatDisplayValue(value)}.`;
      }
      if (expression.type === "CallExpression") {
        return `Logged ${producedLogs.join(" ")}.`;
      }
      return "Evaluated an expression with no side effect.";
    }
    default:
      return "Executed a statement.";
  }
}

/**
 * Walk and execute a parsed program, producing one immutable snapshot per
 * executed statement (plus an initial snapshot).
 *
 * Never throws: failures are reported as an `ExecutionResult` with the
 * partial timeline so the UI can show exactly where execution broke.
 */
export function executeProgram(program: Program): ExecutionResult {
  const env = new Environment();
  const output: ExecutionOutput = { logs: [], pushLog: (line) => output.logs.push(line) };
  const snapshots: Snapshot[] = [createInitialSnapshot()];

  try {
    assertSupportedProgram(program);

    for (const statement of program.body) {
      if (isNoOp(statement)) continue;

      const logsBefore = output.logs.length;
      const line = statement.loc?.start?.line ?? 0;

      try {
        executeStatement(env, output, statement);
      } catch (err) {
        if (err instanceof CodeScopeError) throw err.attachLocation(statement.loc?.start);
        throw err;
      }

      snapshots.push(
        createSnapshot({
          index: snapshots.length,
          line,
          variables: env.snapshotVariables(),
          console: output.logs,
          description: describeStatement(statement, env, output.logs.slice(logsBefore)),
        }),
      );
    }

    return { ok: true, snapshots };
  } catch (err) {
    if (err instanceof CodeScopeError) {
      return { ok: false, error: err.toExecutionError(), snapshots };
    }
    // Unknown interpreter bug — never crash the app with a raw exception.
    return {
      ok: false,
      error: { kind: "runtime", message: "Unexpected interpreter error." },
      snapshots,
    };
  }
}

// Re-exported for the public API; kept out of the way of the implementation.
export type { RuntimeValue };
