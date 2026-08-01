import { formatDisplayValue } from "../engine/format";
import { buildExplainPrompt, parseExplanation } from "./prompt";
import type {
  AIErrorKind,
  AIProviderConfig,
  AIProviderKind,
  AIProviderMeta,
  ExplainPayload,
  Explanation,
  ExplanationStreamEvent,
} from "./types";
import { AIError } from "./types";

/**
 * AI providers — the transport seam of the AI layer.
 *
 * Every provider implements the same {@link AIProvider} contract (`complete`
 * for one-shot responses, `stream` for SSE-style streams, `supportsStreaming`
 * so the orchestrator can fall back automatically). Providers are constructed
 * with an explicit config; API keys come from environment variables and are
 * resolved server-side (see {@link createProvider}). Nothing here knows about
 * React or the UI.
 *
 * Extensibility: future AI features (quiz generation, optimization tips, code
 * review, natural-language debugging) reuse the same provider seam — they
 * build their own prompt and parse their own output against {@link AIProvider}.
 */
export interface AIProvider {
  readonly kind: AIProviderKind;
  readonly model: string;
  /** Whether this provider can stream. Orchestrators fall back when false. */
  readonly supportsStreaming: boolean;
  /** One-shot explanation request. */
  complete(
    payload: ExplainPayload,
    options: ProviderCallOptions,
  ): Promise<Explanation>;
  /** Streamed explanation request; always terminates with complete/error. */
  stream(payload: ExplainPayload, options: ProviderCallOptions): AsyncGenerator<ExplanationStreamEvent>;
}

export interface ProviderCallOptions {
  readonly temperature: number;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

export const AI_PROVIDER_META: Record<AIProviderKind, AIProviderMeta> = {
  openai: {
    kind: "openai",
    label: "OpenAI",
    description: "GPT models via the OpenAI chat completions API.",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
  },
  gemini: {
    kind: "gemini",
    label: "Google Gemini",
    description: "Gemini models via the Generative Language API.",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-1.5-flash",
  },
  mock: {
    kind: "mock",
    label: "Local (offline)",
    description: "Deterministic, offline explanations built from the snapshot.",
    envKey: "",
    defaultModel: "codescope-mock",
  },
};

/** Model suggestions shown in the settings dialog per provider. */
export const SUGGESTED_MODELS: Record<AIProviderKind, readonly string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
  mock: ["codescope-mock"],
};

/** Read `process.env` when running under Node (guard for browser bundles). */
export function readProcessEnv(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env ?? {};
}

/** Resolve the API key for a provider from an environment map. */
export function resolveEnvKey(
  kind: AIProviderKind,
  env: Record<string, string | undefined> = readProcessEnv(),
): string | undefined {
  const meta = AI_PROVIDER_META[kind];
  if (!meta.envKey) return undefined;
  const value = env[meta.envKey];
  return value && value.trim() ? value.trim() : undefined;
}

export interface CreateProviderOptions {
  model?: string;
  temperature?: number;
  stream?: boolean;
  /** Explicit key; when absent, resolved from the environment. */
  apiKey?: string;
  /** Env map used to resolve the key (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
  /** Override the fetch implementation (used by tests). */
  fetchImpl?: typeof fetch;
  /** Mock-only: delay between streamed chunks (ms). */
  chunkDelayMs?: number;
}

/** Create a provider instance. Never throws — missing keys fail at call time. */
export function createProvider(kind: AIProviderKind, options: CreateProviderOptions = {}): AIProvider {
  const meta = AI_PROVIDER_META[kind];
  const model = options.model ?? meta.defaultModel;
  const temperature = options.temperature ?? 0.7;
  const stream = options.stream ?? true;
  const env = options.env ?? readProcessEnv();
  const apiKey = options.apiKey ?? resolveEnvKey(kind, env);

  switch (kind) {
    case "openai":
      return new OpenAIProvider({ model, temperature, stream, apiKey, fetchImpl: options.fetchImpl });
    case "gemini":
      return new GeminiProvider({ model, temperature, stream, apiKey, fetchImpl: options.fetchImpl });
    case "mock":
      return new MockProvider({
        model,
        temperature,
        stream,
        chunkDelayMs: options.chunkDelayMs ?? 0,
      });
  }
}

/** Map an HTTP status to an AIErrorKind, or undefined when the call succeeded. */
function statusToErrorKind(status: number): AIErrorKind | undefined {
  if (status === 401 || status === 403) return "missing-api-key";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "provider-unavailable";
  if (status >= 400) return "bad-response";
  return undefined;
}

function errorMessageFor(kind: AIErrorKind, status: number | undefined): string {
  switch (kind) {
    case "missing-api-key":
      return "The provider is not configured. Add the API key to the server environment variables.";
    case "rate-limit":
      return "The provider is rate-limiting requests. Wait a moment and try again.";
    case "provider-unavailable":
      return "The provider is unavailable right now. Try again shortly.";
    case "bad-response":
      return `The provider returned an unexpected response${status ? ` (HTTP ${status})` : ""}.`;
    case "network":
      return "Network request failed. Check your connection and try again.";
    case "cancelled":
      return "The request was cancelled.";
  }
}

/** Normalize any thrown value into an AIError. */
function normalizeError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AIError("cancelled", errorMessageFor("cancelled", undefined));
  }
  if (error instanceof TypeError) {
    return new AIError("network", errorMessageFor("network", undefined));
  }
  const message = error instanceof Error ? error.message : String(error);
  return new AIError("provider-unavailable", message);
}

/** Read an SSE stream line by line (Node 18+ and browsers both support this). */
async function* sseLines(response: Response): AsyncGenerator<string> {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield line;
      newline = buffer.indexOf("\n");
    }
  }
  const rest = buffer.trim();
  if (rest) yield rest;
}

/** Yield only the `data:` payloads of an SSE stream. */
async function* sseData(response: Response): AsyncGenerator<string> {
  for await (const line of sseLines(response)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data) yield data;
  }
}

interface HTTPProviderConfig extends AIProviderConfig {
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
}

/** Shared request/parse logic for HTTP-backed providers. */
abstract class BaseHTTPProvider implements AIProvider {
  abstract readonly kind: AIProviderKind;
  abstract readonly supportsStreaming: boolean;

  readonly model: string;
  readonly temperature: number;
  readonly streamEnabled: boolean;
  readonly apiKey?: string;
  readonly fetchImpl: typeof fetch;

  constructor(config: HTTPProviderConfig) {
    this.model = config.model;
    this.temperature = config.temperature;
    this.streamEnabled = config.stream;
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
  }

  /** Provider-specific API endpoint. */
  protected abstract endpoint(stream: boolean): string;
  /** Provider-specific request headers (auth included). */
  protected abstract headers(): Record<string, string>;
  /** Provider-specific request body. */
  protected abstract body(system: string, user: string, stream: boolean): unknown;
  /** Extract the full text from a non-streamed JSON response. */
  protected abstract extractCompleteText(json: unknown): string;
  /** Extract one delta from a streamed `data:` payload. */
  protected abstract extractStreamChunk(data: string): string;

  protected async request(
    payload: ExplainPayload,
    options: ProviderCallOptions,
    stream: boolean,
  ): Promise<Response> {
    if (!this.apiKey) {
      throw new AIError("missing-api-key", errorMessageFor("missing-api-key", undefined));
    }
    const { system, user } = buildExplainPrompt(payload);
    const fetchImpl = options.fetchImpl ?? this.fetchImpl;
    return fetchImpl(this.endpoint(stream), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers() },
      body: JSON.stringify(this.body(system, user, stream)),
      signal: options.signal,
    });
  }

  async complete(payload: ExplainPayload, options: ProviderCallOptions): Promise<Explanation> {
    try {
      const response = await this.request(payload, options, false);
      const kind = statusToErrorKind(response.status);
      if (kind !== undefined) {
        throw new AIError(kind, errorMessageFor(kind, response.status), response.status);
      }
      const json: unknown = await response.json();
      const text = this.extractCompleteText(json);
      return parseExplanation(text);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async *stream(
    payload: ExplainPayload,
    options: ProviderCallOptions,
  ): AsyncGenerator<ExplanationStreamEvent> {
    yield { type: "start", provider: this.kind, model: this.model };
    try {
      const response = await this.request(payload, options, true);
      const kind = statusToErrorKind(response.status);
      if (kind !== undefined) {
        throw new AIError(kind, errorMessageFor(kind, response.status), response.status);
      }
      let text = "";
      for await (const data of sseData(response)) {
        if (data === "[DONE]") continue;
        const chunk = this.extractStreamChunk(data);
        if (chunk) {
          text += chunk;
          yield { type: "delta", text: chunk };
        }
      }
      yield {
        type: "complete",
        explanation: parseExplanation(text),
        fromCache: false,
        streamed: true,
        provider: this.kind,
        model: this.model,
      };
    } catch (error) {
      yield { type: "error", error: normalizeError(error) };
    }
  }
}

class OpenAIProvider extends BaseHTTPProvider {
  readonly kind = "openai" as const;
  readonly supportsStreaming = true;

  protected endpoint(_stream: boolean): string {
    return "https://api.openai.com/v1/chat/completions";
  }
  protected headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey ?? ""}` };
  }
  protected body(system: string, user: string, stream: boolean): unknown {
    return {
      model: this.model,
      temperature: this.temperature,
      stream,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
  }
  protected extractCompleteText(json: unknown): string {
    const message = (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message;
    return message?.content ?? "";
  }
  protected extractStreamChunk(data: string): string {
    try {
      const parsed = JSON.parse(data) as {
        choices?: { delta?: { content?: string } }[];
      };
      return parsed.choices?.[0]?.delta?.content ?? "";
    } catch {
      return "";
    }
  }
}

class GeminiProvider extends BaseHTTPProvider {
  readonly kind = "gemini" as const;
  readonly supportsStreaming = true;

  protected endpoint(stream: boolean): string {
    const base = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}`;
    return stream
      ? `${base}:streamGenerateContent?alt=sse&key=${this.apiKey ?? ""}`
      : `${base}:generateContent?key=${this.apiKey ?? ""}`;
  }
  protected headers(): Record<string, string> {
    return {};
  }
  protected body(system: string, user: string, _stream: boolean): unknown {
    return {
      contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: { temperature: this.temperature },
    };
  }
  protected extractCompleteText(json: unknown): string {
    const candidates = (json as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    })?.candidates;
    const parts = candidates?.[0]?.content?.parts ?? [];
    return parts.map((part) => part.text ?? "").join("");
  }
  protected extractStreamChunk(data: string): string {
    try {
      const parsed = JSON.parse(data) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const parts = parsed.candidates?.[0]?.content?.parts ?? [];
      return parts.map((part) => part.text ?? "").join("");
    } catch {
      return "";
    }
  }
}

const TYPE_CONCEPTS: Record<string, { concept: string; mistake: string }> = {
  declaration: {
    concept:
      "Variable declaration: `let`, `const`, and `var` bind a name to a value in the current scope. `let` and `const` are block-scoped; `var` is function-scoped.",
    mistake:
      "Using a variable before it is declared throws a ReferenceError for `let`/`const` (temporal dead zone). Declare before you read.",
  },
  assignment: {
    concept:
      "Assignment stores a new value into an existing binding. The right-hand side is evaluated first, then stored into the variable.",
    mistake:
      "Confusing `=` (assignment) with `==`/`===` (comparison) — a common source of silent bugs.",
  },
  condition: {
    concept:
      "Conditionals evaluate a boolean expression and run one branch. Non-boolean values follow JavaScript truthiness (0, '', null, undefined, NaN are falsy).",
    mistake:
      "Using `=` inside a condition assigns instead of comparing, which always evaluates to a truthy value.",
  },
  loop: {
    concept:
      "Loops repeat a body while a condition holds. Each iteration re-checks the condition; counters must move toward the exit condition or the loop never ends.",
    mistake:
      "Forgetting to update the loop counter (or updating it in the wrong direction) causes an infinite loop.",
  },
  call: {
    concept:
      "Calling a function creates a new frame on the call stack with its own local scope, runs the body, and returns control to the call site.",
    mistake:
      "Expecting a function to mutate a caller's primitive argument — primitives are passed by value.",
  },
  return: {
    concept:
      "`return` ends function execution immediately and hands a value back to the caller. Without `return`, a function resolves to undefined.",
    mistake:
      "Calling a function without `return` and expecting its value — the result is undefined.",
  },
  console: {
    concept:
      "`console.log` writes output to the console. It is for observation only and does not change program state.",
    mistake:
      "Using `console.log` where you meant to return a value from a function.",
  },
  other: {
    concept:
      "This step executed a statement at the top level of the program, outside any function or control structure.",
    mistake:
      "Forgetting that top-level code runs immediately, in source order, from top to bottom.",
  },
};

/** Deterministic, offline explanation of a payload (mock provider). */
function mockExplanation(payload: ExplainPayload): Explanation {
  const type = payload.snapshotType;
  const knowledge = TYPE_CONCEPTS[type] ?? TYPE_CONCEPTS.other;

  const changes: string[] = [];
  for (const change of payload.diff.changedVariables) {
    changes.push(
      `${change.name}: ${formatDisplayValue(change.before)} → ${formatDisplayValue(change.after)}`,
    );
  }
  for (const name of payload.diff.addedVariables) changes.push(`declared ${name}`);
  for (const name of payload.diff.removedVariables) changes.push(`removed ${name}`);
  if (payload.diff.consoleAdded.length > 0) {
    changes.push(`console output: ${payload.diff.consoleAdded.join(" ")}`);
  }
  if (payload.diff.framesAdded > 0) changes.push(`entered ${payload.diff.framesAdded} function frame(s)`);
  if (payload.diff.framesRemoved > 0) changes.push(`left ${payload.diff.framesRemoved} function frame(s)`);
  for (const id of payload.diff.heapAdded) changes.push(`allocated ${id}`);
  for (const id of payload.diff.heapChanged) changes.push(`mutated ${id}`);
  if (changes.length === 0) changes.push("no state changed at this step");

  const location =
    payload.currentLine > 0 ? `line ${payload.currentLine}` : "the program start";
  const scope = Object.keys(payload.variables);
  const frame = payload.callStack.length > 0 ? ` inside ${payload.callStack[payload.callStack.length - 1].name}()` : "";
  const loopNote =
    payload.loop && payload.iteration !== undefined
      ? ` (${payload.loop} loop, iteration ${payload.iteration})`
      : "";
  const conditionNote =
    payload.condition !== undefined
      ? ` The condition "${payload.condition}" evaluated to ${String(payload.conditionResult)}.`
      : "";

  const summary = `At ${location}${frame}${loopNote}, the interpreter executed: "${payload.description}".${conditionNote} ${
    scope.length > 0 ? `Variables in scope: ${scope.join(", ")}.` : "No variables are in scope yet."
  }`;

  const reason = `This step is classified as a ${type}. ${
    payload.previousSnapshotDescription
      ? `It follows the previous step, which "${payload.previousSnapshotDescription}".`
      : "It is the first recorded step of this execution."
  } ${changes[0] ?? ""}`;

  const nextStep =
    payload.loop && payload.iteration !== undefined
      ? `The ${payload.loop} loop continues: the next iteration re-checks its condition and runs the body again unless it is false.`
      : payload.callStack.length > 0
        ? `Execution continues with the next statement inside ${payload.callStack[payload.callStack.length - 1].name}(), or returns to the caller when the function ends.`
        : "Execution continues with the next statement in the program, top to bottom.";

  const confidence: Explanation["confidence"] = payload.description ? "high" : "medium";

  return {
    summary,
    reason,
    changes,
    concept: knowledge.concept,
    commonMistake: knowledge.mistake,
    nextStep,
    confidence,
  };
}

interface MockProviderConfig {
  readonly model: string;
  readonly temperature: number;
  readonly stream: boolean;
  readonly chunkDelayMs: number;
}

class MockProvider implements AIProvider {
  readonly kind = "mock" as const;
  readonly supportsStreaming = true;
  readonly model: string;
  readonly temperature: number;
  readonly streamEnabled: boolean;
  readonly chunkDelayMs: number;

  constructor(config: MockProviderConfig) {
    this.model = config.model;
    this.temperature = config.temperature;
    this.streamEnabled = config.stream;
    this.chunkDelayMs = config.chunkDelayMs;
  }

  private async delay(): Promise<void> {
    if (this.chunkDelayMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, this.chunkDelayMs));
  }

  async complete(payload: ExplainPayload): Promise<Explanation> {
    return mockExplanation(payload);
  }

  async *stream(payload: ExplainPayload): AsyncGenerator<ExplanationStreamEvent> {
    yield { type: "start", provider: this.kind, model: this.model };
    const explanation = mockExplanation(payload);
    // Stream the summary word by word so the UI shows real progress; the full
    // structured explanation arrives with the `complete` event.
    const words = explanation.summary.split(/(\s+)/);
    for (const word of words) {
      if (!word) continue;
      await this.delay();
      yield { type: "delta", text: word };
    }
    yield {
      type: "complete",
      explanation,
      fromCache: false,
      streamed: true,
      provider: this.kind,
      model: this.model,
    };
  }
}
