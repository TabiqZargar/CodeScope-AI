import type { RuntimeValue, Snapshot } from "../engine/types";
import type { SnapshotType } from "../debugger/snapshot-type";

/**
 * Shared types for the CodeScope AI layer.
 *
 * The AI layer is deliberately isolated: it consumes immutable engine
 * snapshots (and debugger-derived facts like the snapshot type), builds a
 * minimal, security-scrubbed payload, and hands it to a provider. It never
 * executes code, never reads UI state (breakpoints, bookmarks, settings), and
 * never includes source text.
 */

/** Providers the layer can talk to. `mock` is a deterministic local provider. */
export type AIProviderKind = "openai" | "gemini" | "mock";

/**
 * Non-secret configuration for a provider. API keys are never part of this —
 * they are read from environment variables (server-side) or injected when the
 * provider is constructed.
 */
export interface AIProviderConfig {
  readonly model: string;
  readonly temperature: number;
  /** Request a streamed response. Providers that cannot stream fall back. */
  readonly stream: boolean;
}

/** Human-facing registry entry for a provider (used by the settings dialog). */
export interface AIProviderMeta {
  readonly kind: AIProviderKind;
  readonly label: string;
  readonly description: string;
  /** Environment variable that holds the API key (never sent to the client). */
  readonly envKey: string;
  readonly defaultModel: string;
}

/**
 * The structured, snapshot-derived payload sent to the model. Every field is a
 * fact already recorded by the interpreter — nothing is invented here, and no
 * source code or local UI state is ever included.
 */
export interface ExplainPayload {
  /** 1-based source line (0 = program start). */
  readonly currentLine: number;
  /** Human-readable step description emitted by the interpreter. */
  readonly description: string;
  /** Debugger classification of this step. */
  readonly snapshotType: SnapshotType;
  /** Variables in scope at this snapshot. */
  readonly variables: Readonly<Record<string, RuntimeValue>>;
  /** Call-stack frames, outermost first, innermost last (names + locals). */
  readonly callStack: readonly CallFrameFact[];
  /** Compact heap view: reference ids with their current content. */
  readonly heap: readonly HeapNodeFact[];
  /** Console output up to and including this snapshot. */
  readonly console: readonly string[];
  /** Source text of the last evaluated condition, when this is a decision. */
  readonly condition?: string;
  /** Boolean outcome of that condition. */
  readonly conditionResult?: boolean;
  /** Loop construct producing this snapshot, when inside a loop. */
  readonly loop?: "for" | "while" | "do-while";
  /** 1-based iteration number for loop snapshots. */
  readonly iteration?: number;
  /** What changed since the previous snapshot (facts only). */
  readonly diff: DiffFact;
  /** Description of the previous snapshot, when one exists. */
  readonly previousSnapshotDescription?: string;
}

/** A call-stack frame in the payload (id is intentionally excluded). */
export interface CallFrameFact {
  readonly name: string;
  readonly variables: Readonly<Record<string, RuntimeValue>>;
}

/** A heap node in the payload (content kept compact). */
export type HeapNodeFact =
  | { readonly id: string; readonly type: "object"; readonly properties: Readonly<Record<string, RuntimeValue>> }
  | { readonly id: string; readonly type: "array"; readonly elements: readonly RuntimeValue[] };

/** Snapshot diff reduced to the facts an explanation needs. */
export interface DiffFact {
  readonly addedVariables: readonly string[];
  readonly changedVariables: readonly VariableChangeFact[];
  readonly removedVariables: readonly string[];
  readonly consoleAdded: readonly string[];
  readonly framesAdded: number;
  readonly framesRemoved: number;
  readonly heapAdded: readonly string[];
  readonly heapChanged: readonly string[];
}

export interface VariableChangeFact {
  readonly name: string;
  readonly before: RuntimeValue;
  readonly after: RuntimeValue;
}

/**
 * A complete explanation of one snapshot. Structured so the UI can render
 * separate tabs (Explain / Concept / Changes / Next) and show a confidence
 * badge without re-parsing free text.
 */
export interface Explanation {
  readonly summary: string;
  readonly reason: string;
  readonly changes: readonly string[];
  readonly concept: string;
  readonly commonMistake: string;
  readonly nextStep: string;
  readonly confidence: "high" | "medium" | "low";
}

/** Transport-level error kinds, mapped to friendly UI states. */
export type AIErrorKind =
  | "missing-api-key"
  | "network"
  | "rate-limit"
  | "provider-unavailable"
  | "bad-response"
  | "cancelled";

/** Typed error thrown by providers and the orchestrator. Never a crash. */
export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly status?: number;

  constructor(kind: AIErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AIError";
    this.kind = kind;
    this.status = status;
  }
}

/** Events emitted by a streamed explanation (provider or orchestrator). */
export type ExplanationStreamEvent =
  | { readonly type: "start"; readonly provider: AIProviderKind; readonly model: string }
  | { readonly type: "delta"; readonly text: string }
  | {
      readonly type: "complete";
      readonly explanation: Explanation;
      readonly fromCache: boolean;
      readonly streamed: boolean;
      readonly provider: AIProviderKind;
      readonly model: string;
    }
  | { readonly type: "error"; readonly error: AIError };

/** What a snapshot explanation request carries, beyond the snapshot itself. */
export interface ExplainRequest {
  readonly snapshot: Snapshot;
  /** Chronological predecessor, when this is not the first step. */
  readonly previous?: Snapshot;
  readonly provider: AIProviderKind;
  readonly model: string;
  readonly temperature: number;
  /** Prefer a streamed response; providers fall back automatically. */
  readonly stream?: boolean;
  /** Cache to consult first / write into. Optional (disabled when absent). */
  readonly cache?: ExplanationCache;
  /** Override the fetch implementation (tests, mock transports). */
  readonly fetchImpl?: typeof fetch;
  /** Abort in-flight work. */
  readonly signal?: AbortSignal;
}

/** The cache contract used by the orchestrator. */
export interface ExplanationCache {
  get(key: string): Explanation | undefined;
  set(key: string, explanation: Explanation): void;
  has(key: string): boolean;
  clear(): void;
  readonly size: number;
}
