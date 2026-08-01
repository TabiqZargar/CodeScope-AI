import { isHeapReference } from "../engine";
import type { HeapNode, RuntimeValue, Snapshot } from "../engine";

/**
 * Watch expressions — pure evaluation against a single snapshot.
 *
 * Watches are evaluated ONLY against the selected immutable snapshot (its
 * variables, call-stack frames and heap). Nothing here touches the runtime or
 * re-executes code, so a value updates exactly when the selection changes and
 * the cost is O(number of watches).
 *
 * Supported grammar:
 *   Expr := Ident ( "." Ident | "[" ( Number | "String" | Ident ) "]" )*
 *
 * Examples: `x`, `user.age`, `items[0]`, `items.length`, `result.total`,
 * `obj[key]`, `matrix[i][j]`.
 *
 * Extensibility: watch history and live expression graphs later consume the
 * same `evaluateWatchExpression` result and can add per-snapshot history by
 * recording (snapshotIndex, result) pairs.
 */
export type WatchEvalResult =
  | { readonly ok: true; readonly value: RuntimeValue }
  | { readonly ok: false; readonly reason: "empty" | "invalid-syntax" | "unknown-identifier" };

interface ParsedWatch {
  readonly root: string;
  readonly members: readonly WatchMember[];
}

type WatchMember =
  | { readonly kind: "prop"; readonly name: string }
  | { readonly kind: "computed"; readonly key: string };

const IDENTIFIER = "[A-Za-z_$][A-Za-z0-9_$]*";
const WATCH_PATTERN = new RegExp(`^(${IDENTIFIER})((?:\\.[A-Za-z_$][A-Za-z0-9_$]*|\\[[^\\]]*\\])*)$`);
const MEMBER_PATTERN = new RegExp(`\\.(${IDENTIFIER})|\\[([^\\]]*)\\]`, "g");

/**
 * Parse a watch expression into a root identifier plus members. Returns null
 * for anything outside the supported grammar (operators, calls, whitespace
 * inside brackets, etc.).
 */
export function parseWatchExpression(expression: string): ParsedWatch | null {
  const text = expression.trim();
  if (!text) return null;
  const match = WATCH_PATTERN.exec(text);
  if (!match) return null;

  const members: WatchMember[] = [];
  let memberMatch: RegExpExecArray | null;
  MEMBER_PATTERN.lastIndex = 0;
  while ((memberMatch = MEMBER_PATTERN.exec(match[2]))) {
    if (memberMatch[1] !== undefined) {
      members.push({ kind: "prop", name: memberMatch[1] });
    } else {
      const raw = memberMatch[2].trim();
      if (!raw) return null;
      members.push({ kind: "computed", key: raw });
    }
  }
  return { root: match[1], members };
}

const MISSING = Symbol("missing");

/** Resolve a bare identifier: call-stack frames (innermost first) then globals. */
function resolveBinding(name: string, snapshot: Snapshot): RuntimeValue | typeof MISSING {
  const frames = snapshot.callStack ?? [];
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const vars = frames[i].variables;
    if (name in vars) return vars[name];
  }
  if (name in snapshot.variables) return snapshot.variables[name];
  return MISSING;
}

/** Resolve the key inside `[ ... ]`: number, quoted string, or identifier. */
function resolveComputedKey(raw: string, heap: Map<string, HeapNode>, snapshot: Snapshot): RuntimeValue {
  const text = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  const quoted = /^(['"])([\s\S]*)\1$/.exec(text);
  if (quoted) return quoted[2];
  if (new RegExp(`^${IDENTIFIER}$`).test(text)) {
    const resolved = resolveBinding(text, snapshot);
    if (resolved === MISSING) return undefined;
    return isHeapReference(resolved) ? resolved.id : resolved;
  }
  return undefined;
}

/**
 * Resolve one member access against the current value. Missing members,
 * member access on primitives, and out-of-range indices all yield
 * `undefined` (JavaScript semantics without the throwing on null/undefined).
 */
function resolveMember(
  base: RuntimeValue,
  member: WatchMember,
  heap: Map<string, HeapNode>,
  snapshot: Snapshot,
): RuntimeValue {
  if (isHeapReference(base)) {
    const node = heap.get(base.id);
    if (!node) return undefined;
    if (member.kind === "prop") {
      if (node.type === "object") return node.properties[member.name];
      if (member.name === "length") return node.elements.length;
      return undefined;
    }
    const key = resolveComputedKey(member.key, heap, snapshot);
    if (node.type === "array") {
      if (key === "length") return node.elements.length;
      const index = typeof key === "number" ? key : Number(key);
      if (!Number.isFinite(index)) return undefined;
      return node.elements[Math.trunc(index)];
    }
    return node.properties[String(key)];
  }
  if (typeof base === "string" && member.kind === "prop" && member.name === "length") {
    return base.length;
  }
  return undefined;
}

/**
 * Evaluate a watch expression against a snapshot. Never throws: failures are
 * reported through the discriminated result, and the UI renders them as a
 * graceful `undefined`.
 */
export function evaluateWatchExpression(expression: string, snapshot: Snapshot): WatchEvalResult {
  const parsed = parseWatchExpression(expression);
  if (!parsed) return { ok: false, reason: expression.trim() ? "invalid-syntax" : "empty" };

  const heap = new Map<string, HeapNode>((snapshot.heap ?? []).map((node) => [node.id, node]));
  const base = resolveBinding(parsed.root, snapshot);
  if (base === MISSING) return { ok: false, reason: "unknown-identifier" };

  let value: RuntimeValue = base;
  for (const member of parsed.members) {
    value = resolveMember(value, member, heap, snapshot);
  }
  return { ok: true, value };
}

/** Evaluate a batch of watches; one result per expression, O(#watches). */
export function evaluateWatches(
  expressions: readonly string[],
  snapshot: Snapshot | null,
): readonly WatchEvalResult[] {
  if (snapshot === null) return expressions.map(() => ({ ok: false, reason: "unknown-identifier" }));
  return expressions.map((expression) => evaluateWatchExpression(expression, snapshot));
}

/** True when a watch resolves to a defined value in this snapshot (search aid). */
export function watchHasValue(expression: string, snapshot: Snapshot): boolean {
  const result = evaluateWatchExpression(expression, snapshot);
  return result.ok && result.value !== undefined;
}
