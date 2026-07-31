import {
  CodeScopeError,
  isHeapReference,
  type HeapNode,
  type HeapReference,
  type RuntimeValue,
} from "./types";

/** Mutable object node: the interpreter mutates this, snapshots copy it. */
interface MutableObject {
  id: string;
  type: "object";
  properties: Map<string, RuntimeValue>;
}

/** Mutable array node: elements grow/shrink via the array methods. */
interface MutableArray {
  id: string;
  type: "array";
  elements: RuntimeValue[];
}

type MutableNode = MutableObject | MutableArray;

/** Array methods the interpreter supports, matching JS return values. */
export const ARRAY_METHODS: ReadonlySet<string> = new Set(["push", "pop", "shift", "unshift"]);

/**
 * Coerce a member key to an array index when it is one (integer ≥ 0, or a
 * string of digits like `arr["0"]`), otherwise `null`.
 */
function toArrayIndex(key: number | string): number | null {
  if (typeof key === "number") {
    return Number.isInteger(key) && key >= 0 ? key : null;
  }
  return /^(0|[1-9]\d*)$/.test(key) ? Number(key) : null;
}

/**
 * The runtime heap: every allocated object and array, identified by a stable
 * reference (`ref_1`, `ref_2`, …).
 *
 * The heap is fully React-free and JSON-serializable. It mutates in place
 * while a program runs; immutable `HeapNode[]` snapshots are derived on
 * demand, which is what the UI renders and scrubs through.
 *
 * References are canonical per id (the same frozen instance is returned for
 * the same id), so aliasing — `const b = a` — shares one reference and JS
 * `===` identity checks behave correctly.
 */
export class Heap {
  private readonly nodes: MutableNode[] = [];
  private readonly byId = new Map<string, MutableNode>();
  private readonly refs = new Map<string, HeapReference>();
  private counter = 0;

  /** Number of live (allocated, never freed) nodes. */
  get size(): number {
    return this.nodes.length;
  }

  private ref(id: string): HeapReference {
    let reference = this.refs.get(id);
    if (!reference) {
      reference = Object.freeze({ id });
      this.refs.set(id, reference);
    }
    return reference;
  }

  /** Allocate a plain object; returns a reference to it. */
  allocateObject(properties: Record<string, RuntimeValue> = {}): HeapReference {
    const id = this.nextId();
    const node: MutableObject = { id, type: "object", properties: new Map(Object.entries(properties)) };
    this.nodes.push(node);
    this.byId.set(id, node);
    return this.ref(id);
  }

  /** Allocate an array; returns a reference to it. */
  allocateArray(elements: readonly RuntimeValue[] = []): HeapReference {
    const id = this.nextId();
    const node: MutableArray = { id, type: "array", elements: [...elements] };
    this.nodes.push(node);
    this.byId.set(id, node);
    return this.ref(id);
  }

  private nextId(): string {
    this.counter += 1;
    return `ref_${this.counter}`;
  }

  private require(reference: HeapReference): MutableNode {
    const node = this.byId.get(reference.id);
    if (!node) {
      throw new CodeScopeError({
        kind: "runtime",
        message: `Reference ${reference.id} no longer exists.`,
      });
    }
    return node;
  }

  /** Read a property or array element. Missing values are `undefined` (JS). */
  get(reference: HeapReference, key: number | string): RuntimeValue {
    const node = this.require(reference);
    if (node.type === "array") {
      if (key === "length") return node.elements.length;
      const index = toArrayIndex(key);
      if (index !== null) return index < node.elements.length ? node.elements[index] : undefined;
      // Arbitrary named properties on arrays are not modeled; JS yields undefined.
      return undefined;
    }
    return node.properties.get(String(key)) ?? undefined;
  }

  /** Write a property or array element, growing arrays to fit (JS semantics). */
  set(reference: HeapReference, key: number | string, value: RuntimeValue): void {
    const node = this.require(reference);
    if (node.type === "array") {
      if (key === "length") {
        // `arr.length = n` truncates or extends with holes (only numbers apply).
        if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
          node.elements.length = value;
        }
        return;
      }
      const index = toArrayIndex(key);
      if (index !== null) {
        if (index >= node.elements.length) node.elements.length = index + 1;
        node.elements[index] = value;
        return;
      }
      return; // Named properties on arrays are not modeled.
    }
    node.properties.set(String(key), value);
  }

  /** `Array.prototype.push(...values)`; returns the new length. */
  push(reference: HeapReference, values: readonly RuntimeValue[]): number {
    const node = this.require(reference);
    if (node.type !== "array") throw notAFunction("push");
    node.elements.push(...values);
    return node.elements.length;
  }

  /** `Array.prototype.pop()`; returns the removed element (or `undefined`). */
  pop(reference: HeapReference): RuntimeValue {
    const node = this.require(reference);
    if (node.type !== "array") throw notAFunction("pop");
    return node.elements.pop() ?? undefined;
  }

  /** `Array.prototype.shift()`; returns the removed element (or `undefined`). */
  shift(reference: HeapReference): RuntimeValue {
    const node = this.require(reference);
    if (node.type !== "array") throw notAFunction("shift");
    return node.elements.shift() ?? undefined;
  }

  /** `Array.prototype.unshift(...values)`; returns the new length. */
  unshift(reference: HeapReference, values: readonly RuntimeValue[]): number {
    const node = this.require(reference);
    if (node.type !== "array") throw notAFunction("unshift");
    node.elements.unshift(...values);
    return node.elements.length;
  }

  /** True when a reference with this id exists. */
  has(id: string): boolean {
    return this.byId.has(id);
  }

  /**
   * Immutable view of every allocated node, in allocation order. Fresh copies
   * of each node are frozen so later mutation never touches past snapshots.
   */
  snapshot(): readonly HeapNode[] {
    return this.nodes.map((node) => freezeNode(node));
  }
}

function notAFunction(method: string): CodeScopeError {
  return new CodeScopeError({
    kind: "runtime",
    message: `${method} is not a function.`,
  });
}

function freezeNode(node: MutableNode): HeapNode {
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
    properties: Object.freeze(Object.fromEntries(node.properties)),
  });
}

/** Type guard for heap references (re-exported for engine consumers). */
export { isHeapReference };
