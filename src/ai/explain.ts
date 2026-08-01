import { explanationCacheKey } from "./cache";
import { buildExplainPayload } from "./prompt";
import { createProvider } from "./provider";
import type { AIProvider } from "./provider";
import type {
  AIErrorKind,
  AIProviderKind,
  ExplainRequest,
  Explanation,
  ExplanationStreamEvent,
} from "./types";
import { AIError } from "./types";
/**
 * Explanation orchestration.
 *
 * `explainSnapshot` / `streamExplainSnapshot` are the public entry points of
 * the AI layer. Both are cache-aware, snapshot-driven, and never execute code:
 * they project the snapshot into a payload, ask a provider, and (when a cache
 * is supplied) reuse prior answers keyed on the snapshot hash + provider +
 * model. Streaming falls back automatically when the provider cannot stream.
 */

export interface ExplanationResult {
  readonly explanation: Explanation;
  readonly fromCache: boolean;
  readonly streamed: boolean;
  readonly provider: AIProviderKind;
  readonly model: string;
}

/** Build a provider instance for a request (mock runs in-process). */
export function providerFor(request: ExplainRequest): AIProvider {
  return createProvider(request.provider, {
    model: request.model,
    temperature: request.temperature,
    stream: request.stream ?? true,
    fetchImpl: request.fetchImpl,
  });
}

function cacheKeyFor(request: ExplainRequest): string | undefined {
  if (!request.cache) return undefined;
  return explanationCacheKey(request.snapshot, request.previous, request.provider, request.model);
}

function okResult(
  explanation: Explanation,
  request: ExplainRequest,
  fromCache: boolean,
  streamed: boolean,
): ExplanationResult {
  return {
    explanation,
    fromCache,
    streamed,
    provider: request.provider,
    model: request.model,
  };
}

/** One-shot explanation with cache-first behaviour. */
export async function explainSnapshot(request: ExplainRequest): Promise<ExplanationResult> {
  const key = cacheKeyFor(request);
  if (key && request.cache?.has(key)) {
    const cached = request.cache.get(key);
    if (cached) return okResult(cached, request, true, false);
  }

  const provider = providerFor(request);
  const explanation = await provider.complete(
    buildExplainPayload(request.snapshot, request.previous),
    { temperature: request.temperature, signal: request.signal, fetchImpl: request.fetchImpl },
  );

  if (key) request.cache?.set(key, explanation);
  return okResult(explanation, request, false, false);
}

/**
 * Streamed explanation. Emits `start`, then `delta` events (or `complete`
 * immediately when cached), and always a final `complete`/`error`. Providers
 * that cannot stream are bridged: `complete` runs and a single `complete`
 * event is emitted, so callers never branch on provider capabilities.
 */
export async function* streamExplainSnapshot(
  request: ExplainRequest,
): AsyncGenerator<ExplanationStreamEvent> {
  const provider = providerFor(request);
  const payload = buildExplainPayload(request.snapshot, request.previous);
  const key = cacheKeyFor(request);
  const options = {
    temperature: request.temperature,
    signal: request.signal,
    fetchImpl: request.fetchImpl,
  };

  if (key && request.cache?.has(key)) {
    const cached = request.cache.get(key);
    if (cached) {
      yield {
        type: "complete",
        explanation: cached,
        fromCache: true,
        streamed: false,
        provider: request.provider,
        model: request.model,
      };
      return;
    }
  }

  if (!provider.supportsStreaming || !(request.stream ?? true)) {
    try {
      const explanation = await provider.complete(payload, options);
      if (key) request.cache?.set(key, explanation);
      yield {
        type: "complete",
        explanation,
        fromCache: false,
        streamed: false,
        provider: request.provider,
        model: request.model,
      };
    } catch (error) {
      yield { type: "error", error: toAIError(error) };
    }
    return;
  }

  for await (const event of provider.stream(payload, options)) {
    if (event.type === "complete") {
      if (key) request.cache?.set(key, event.explanation);
      yield { ...event, fromCache: false, streamed: true };
    } else {
      yield event;
    }
  }
}

function toAIError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AIError("cancelled", "The request was cancelled.");
  }
  if (error instanceof TypeError) {
    return new AIError("network", "Network request failed.");
  }
  return new AIError("provider-unavailable", error instanceof Error ? error.message : String(error));
}

/** Friendly user-facing copy for a stream error event. */
export function friendlyError(kind: AIErrorKind): string {
  switch (kind) {
    case "missing-api-key":
      return "AI is not configured. Add the provider API key to the server environment, or switch to the Local provider.";
    case "rate-limit":
      return "The AI provider is rate-limiting requests. Wait a moment and try again.";
    case "provider-unavailable":
      return "The AI provider is unavailable right now. Please try again shortly.";
    case "network":
      return "Network request failed. Check your connection and try again.";
    case "bad-response":
      return "The AI provider returned something unexpected. Please try again.";
    case "cancelled":
      return "The request was cancelled.";
  }
}
