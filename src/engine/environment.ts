import { CodeScopeError, type BindingKind, type RuntimeValue, type VariableRecord } from "./types";

interface Binding {
  kind: BindingKind;
  value: RuntimeValue;
}

/**
 * Mutable scope stack holding every declared variable.
 *
 * The interpreter owns one Environment; immutable snapshots are plain records
 * derived from it after each statement, so the Environment itself is never
 * exposed to the UI.
 *
 * Binding kinds are tracked so `let`/`const`/`var` semantics (redeclaration
 * and const-assignment errors) behave like real JavaScript. Blocks (loop
 * bodies, if/else branches) push a scope so `let`/`const` declared inside a
 * block are fresh on each execution and invisible after it.
 */
export class Environment {
  /** Scope stack; index 0 is the global (program-level) scope. */
  private readonly scopes: Array<Map<string, Binding>> = [new Map()];
  /** Scope indices that begin a call frame, outermost frame first. */
  private readonly frameStarts: number[] = [];

  /** Enter a new block scope (loop body, if/else branch, etc.). */
  pushScope(): void {
    this.scopes.push(new Map());
  }

  /** Exit the innermost block scope. The global scope is never popped. */
  popScope(): void {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  /**
   * Enter a function frame: push a fresh scope that owns the function's
   * parameters and locals. Returns the scope index the frame owns, which the
   * interpreter passes back to `popFrameScope` so all of the frame's nested
   * block scopes are discarded together.
   */
  pushFrameScope(): number {
    this.scopes.push(new Map());
    const start = this.scopes.length - 1;
    this.frameStarts.push(start);
    return start;
  }

  /** Exit a function frame, discarding its scope and every nested block scope. */
  popFrameScope(start: number): void {
    while (this.scopes.length > start) {
      this.scopes.pop();
    }
    this.frameStarts.pop();
  }

  /** Index of the first scope not owned by any frame (i.e. global scopes). */
  get globalScopeCount(): number {
    return this.frameStarts.length === 0 ? 1 : this.frameStarts[0];
  }

  /**
   * Number of scopes currently on the stack. The top frame owns everything
   * from its start index up to (but excluding) this value.
   */
  get scopeCount(): number {
    return this.scopes.length;
  }

  /**
   * Extract the variables visible inside a single frame: every scope from
   * `start` (the frame's own scope) up to `endExclusive` (the next frame's
   * scope, or the top of the stack). Innermost declarations win.
   */
  frameVariables(start: number, endExclusive: number): VariableRecord {
    const record: VariableRecord = {};
    const end = Math.min(endExclusive, this.scopes.length);
    for (let i = start; i < end; i += 1) {
      for (const [name, binding] of this.scopes[i]) {
        record[name] = binding.value;
      }
    }
    return Object.freeze(record);
  }

  private current(): Map<string, Binding> {
    return this.scopes[this.scopes.length - 1];
  }

  /**
   * The scope `var` targets: the innermost function frame's scope when one is
   * active, otherwise the global scope (`var` is function-scoped in JS).
   */
  private varScope(): Map<string, Binding> {
    const lastFrame = this.frameStarts[this.frameStarts.length - 1];
    return lastFrame === undefined ? this.scopes[0] : this.scopes[lastFrame];
  }

  private lookup(name: string): Binding | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i -= 1) {
      const binding = this.scopes[i].get(name);
      if (binding) return binding;
    }
    return undefined;
  }

  /** Declare a new variable in the current scope. */
  declare(name: string, kind: BindingKind, value: RuntimeValue): void {
    // `var` is function-scoped: the innermost frame's scope, or global at top level.
    const target = kind === "var" ? this.varScope() : this.current();
    const existing = target.get(name);
    if (existing && !(existing.kind === "var" && kind === "var")) {
      throw new CodeScopeError({
        kind: "runtime",
        message: `Identifier "${name}" has already been declared.`,
      });
    }
    target.set(name, { kind, value });
  }

  /** Assign to an existing variable (any scope). Throws if missing or const. */
  assign(name: string, value: RuntimeValue): void {
    const binding = this.lookup(name);
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

  /** Read a variable's current value (any scope). Throws if it does not exist. */
  read(name: string): RuntimeValue {
    const binding = this.lookup(name);
    if (!binding) {
      throw new CodeScopeError({
        kind: "runtime",
        message: `${name} is not defined.`,
      });
    }
    return binding.value;
  }

  has(name: string): boolean {
    return this.lookup(name) !== undefined;
  }

  get size(): number {
    return this.scopes.reduce((total, scope) => total + scope.size, 0);
  }

  /** Derive an immutable plain-object view for a snapshot. */
  snapshotVariables(): VariableRecord {
    const record: VariableRecord = {};
    // Innermost scope is written last, so shadowed names show inner values.
    for (const scope of this.scopes) {
      for (const [name, binding] of scope) {
        record[name] = binding.value;
      }
    }
    return Object.freeze(record);
  }
}
