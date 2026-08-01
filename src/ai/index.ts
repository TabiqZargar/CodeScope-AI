/**
 * CodeScope AI layer.
 *
 * A provider-agnostic, snapshot-driven explanation system. It consumes
 * immutable engine snapshots (and debugger-derived classifications), builds a
 * minimal security-scrubbed payload, and asks a provider for a structured
 * explanation — optionally streamed and always cache-aware. It never executes
 * code and never touches React or the interpreter.
 */
export { AIError } from "./types";
export type {
  AIErrorKind,
  AIProviderConfig,
  AIProviderKind,
  AIProviderMeta,
  CallFrameFact,
  DiffFact,
  ExplainPayload,
  ExplainRequest,
  Explanation,
  ExplanationCache,
  ExplanationStreamEvent,
  HeapNodeFact,
  VariableChangeFact,
} from "./types";

export {
  EXPLAIN_SYSTEM_PROMPT,
  buildExplainPayload,
  buildExplainPrompt,
  isUsableExplanation,
  parseExplanation,
} from "./prompt";

export {
  AI_PROVIDER_META,
  SUGGESTED_MODELS,
  createProvider,
  readProcessEnv,
  resolveEnvKey,
} from "./provider";
export type { AIProvider, CreateProviderOptions, ProviderCallOptions } from "./provider";

export {
  createInMemoryCache,
  explanationCacheKey,
  hashString,
  snapshotHash,
} from "./cache";

export { explainSnapshot, friendlyError, providerFor, streamExplainSnapshot } from "./explain";
export type { ExplanationResult } from "./explain";
