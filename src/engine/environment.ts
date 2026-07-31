import { CodeScopeError, type BindingKind, type RuntimeValue, type VariableRecord } from "./types";

interface Binding {
  kind: BindingKind;
  value: RuntimeValue;
}

/**
 * Mutable scope holding every declared variable.
 *
 * The interpreter owns one Environment; immutable snapshots are plain records
 * derived from it after each statement, so the Environment itself is never
 * exposed to the UI.
 *
 * Binding kinds are tracked so `let`/`const`/`var` semantics (redeclaration
 * and const-assignment errors) behave like real JavaScript.
 */
export class Environment {
  private readonly bindings = new Map<string, Binding>();

  /** Declare a new variable. Throws if a `let`/`const` already exists. */
  declare(name: string, kind: BindingKind, value: RuntimeValue): void {
    const existing = this.bindings.get(name);
    if (existing && !(existing.kind === "var" && kind === "var")) {
      throw new CodeScopeError({
        kind: "runtime",
        message: `Identifier "${name}" has already been declared.`,
      });
    }
    this.bindings.set(name, { kind, value });
  }

  /** Assign to an existing variable. Throws if missing or const. */
  assign(name: string, value: RuntimeValue): void {
    const binding = this.bindings.get(name);
    if (!binding) {
      throw new CodeScopeError({
        kind: "runtime",
        message: `${name} is not defined.`,
      });
    }
    if (binding.kind === "const") {
      throw new CodeScopeError({
        kind: "runtime",
        message: `Assignment to constant variable "${name}".`,
      });
    }
    binding.value = value;
  }

  /** Read a variable's current value. Throws if it does not exist. */
  read(name: string): RuntimeValue {
    const binding = this.bindings.get(name);
    if (!binding) {
      throw new CodeScopeError({
        kind: "runtime",
        message: `${name} is not defined.`,
      });
    }
    return binding.value;
  }

  has(name: string): boolean {
    return this.bindings.has(name);
  }

  get size(): number {
    return this.bindings.size;
  }

  /** Derive an immutable plain-object view for a snapshot. */
  snapshotVariables(): VariableRecord {
    const record: VariableRecord = {};
    for (const [name, binding] of this.bindings) {
      record[name] = binding.value;
    }
    return Object.freeze(record);
  }
}
