"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildExplainPayload,
  createInMemoryCache,
  explanationCacheKey,
  friendlyError,
  streamExplainSnapshot,
} from "@/ai";
import type {
  AIErrorKind,
  AIProviderKind,
  Explanation,
  ExplanationStreamEvent,
} from "@/ai";
import type { Snapshot } from "@/engine";

export interface AiSettings {
  provider: AIProviderKind;
  model: string;
  temperature: number;
  stream: boolean;
  cacheEnabled: boolean;
}

export type AiExplainStatus = "idle" | "loading" | "streaming" | "done" | "error";

export interface AiExplainState {
  explanation: Explanation | null;
  streamingText: string;
  status: AiExplainStatus;
  error: string | null;
  fromCache: boolean;
  provider: AIProviderKind | null;
  model: string | null;
  confidence: Explanation["confidence"] | null;
}

export interface ProviderAvailability {
  configured: Record<AIProviderKind, boolean>;
  loaded: boolean;
}

const STORAGE_KEY = "codescope-ai-settings";

const DEFAULT_SETTINGS: AiSettings = {
  provider: "mock",
  model: "codescope-mock",
  temperature: 0.2,
  stream: true,
  cacheEnabled: true,
};

function loadSettings(): AiSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      provider: parsed.provider === "openai" || parsed.provider === "gemini" || parsed.provider === "mock" ? parsed.provider : "mock",
      model: typeof parsed.model === "string" && parsed.model ? parsed.model : DEFAULT_SETTINGS.model,
      temperature: typeof parsed.temperature === "number" ? Math.min(Math.max(parsed.temperature, 0), 1) : 0.2,
      stream: typeof parsed.stream === "boolean" ? parsed.stream : true,
      cacheEnabled: typeof parsed.cacheEnabled === "boolean" ? parsed.cacheEnabled : true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface ConfiguredResponse {
  providers: Array<{ kind: AIProviderKind; configured: boolean }>;
}

/**
 * AI explanation for the currently selected snapshot.
 *
 * Key behaviours:
 *   - transport is picked automatically: the local Mock provider runs
 *     in-process; remote providers go through the /api/ai/explain bridge so
 *     API keys never reach the browser;
 *   - explanations are cached by snapshot hash + provider + model, with a
 *     hard in-memory LRU bound;
 *   - requests are debounced and cancelled when the snapshot changes;
 *   - the previous explanation is never cleared while the snapshot is
 *     unchanged, and stale responses (out-of-order) are discarded.
 */
export function useAiExplain(current: Snapshot | null, previous: Snapshot | undefined) {
  const [settings, setSettingsState] = useState<AiSettings>(loadSettings);
  const [state, setState] = useState<AiExplainState>({
    explanation: null,
    streamingText: "",
    status: "idle",
    error: null,
    fromCache: false,
    provider: null,
    model: null,
    confidence: null,
  });
  const [availability, setAvailability] = useState<ProviderAvailability>({
    configured: { openai: false, gemini: false, mock: true },
    loaded: false,
  });

  const cacheRef = useRef(createInMemoryCache(250));
  const genRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  // Which provider actually answers: fall back to the local provider when a
  // remote one has no server-side API key.
  const effectiveProvider: AIProviderKind = settings.provider === "mock" || availability.configured[settings.provider]
    ? settings.provider
    : "mock";

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // storage unavailable (private mode) — ignore
    }
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ConfiguredResponse | null) => {
        if (cancelled || !data) return;
        const configured: Record<AIProviderKind, boolean> = {
          openai: false,
          gemini: false,
          mock: true,
        };
        for (const entry of data.providers) configured[entry.kind] = entry.configured;
        setAvailability({ configured, loaded: true });
      })
      .catch(() => {
        if (!cancelled) setAvailability((prev) => ({ ...prev, loaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSettings = useCallback(
    (patch: Partial<AiSettings>) => setSettingsState((prev) => ({ ...prev, ...patch })),
    [],
  );

  const commit = useCallback(
    (explanation: Explanation, fromCache: boolean, provider: AIProviderKind, model: string) => {
      setState({
        explanation,
        streamingText: "",
        status: "done",
        error: null,
        fromCache,
        provider,
        model,
        confidence: explanation.confidence,
      });
    },
    [],
  );

  const fail = useCallback((kind: AIErrorKind, message?: string) => {
    setState((prev) => ({
      ...prev,
      streamingText: "",
      status: "error",
      error: message ?? friendlyError(kind),
    }));
  }, []);

  const handleMockEvent = useCallback(
    (event: ExplanationStreamEvent) => {
      switch (event.type) {
        case "start":
          setState((s) => ({ ...s, status: "streaming" }));
          break;
        case "delta":
          setState((s) => ({ ...s, status: "streaming", streamingText: s.streamingText + event.text }));
          break;
        case "complete":
          commit(event.explanation, event.fromCache, event.provider, event.model);
          break;
        case "error":
          fail(event.error.kind);
          break;
      }
    },
    [commit, fail],
  );

  const run = useCallback(
    async (snapshot: Snapshot, prev: Snapshot | undefined) => {
      const gen = ++genRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setState((s) => ({ ...s, streamingText: "", status: "loading", error: null, fromCache: false }));

      const provider = effectiveProvider;

      const cacheKey = settings.cacheEnabled
        ? explanationCacheKey(snapshot, prev, provider, settings.model)
        : null;
      if (cacheKey && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          if (gen !== genRef.current) return;
          commit(cached, true, provider, settings.model);
          return;
        }
      }

      if (provider === "mock") {
        try {
          for await (const event of streamExplainSnapshot({
            snapshot,
            previous: prev,
            provider,
            model: settings.model,
            temperature: settings.temperature,
            stream: settings.stream,
            cache: settings.cacheEnabled ? cacheRef.current : undefined,
            signal: controller.signal,
          })) {
            if (gen !== genRef.current) return;
            handleMockEvent(event);
          }
        } catch (error) {
          if (gen !== genRef.current) return;
          fail(abortKind(error));
        }
        return;
      }

      const payload = buildExplainPayload(snapshot, prev);
      try {
        const res = await fetch("/api/ai/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload,
            provider,
            model: settings.model,
            temperature: settings.temperature,
            stream: settings.stream,
          }),
          signal: controller.signal,
        });

        if (settings.stream) {
          if (!res.body) {
            fail("bad-response");
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let acc = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (gen !== genRef.current) return;
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";
            for (const part of parts) {
              const line = part.trim();
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data) continue;
              let event: ExplanationStreamEvent;
              try {
                event = JSON.parse(data) as ExplanationStreamEvent;
              } catch {
                continue;
              }
              if (gen !== genRef.current) return;
              if (event.type === "error") {
                fail(event.error.kind);
                await reader.cancel();
                return;
              }
              if (event.type === "delta") {
                acc += event.text;
                setState((s) => ({ ...s, status: "streaming", streamingText: acc }));
                const parsed = maybeParse(acc);
                if (parsed) {
                  commit(parsed, false, provider, settings.model);
                  if (cacheKey) cacheRef.current.set(cacheKey, parsed);
                  await reader.cancel();
                  return;
                }
              }
              if (event.type === "complete") {
                commit(event.explanation, event.fromCache, provider, settings.model);
                if (cacheKey && !event.fromCache) cacheRef.current.set(cacheKey, event.explanation);
                return;
              }
            }
          }
          // stream ended without a usable parse → fall back to whatever text we have
          const parsed = maybeParse(acc);
          if (parsed) {
            commit(parsed, false, provider, settings.model);
            if (cacheKey) cacheRef.current.set(cacheKey, parsed);
          } else if (gen === genRef.current && acc.trim()) {
            fail("bad-response");
          }
          return;
        }

        const data = (await res.json()) as
          | { explanation: Explanation }
          | { error: { kind: AIErrorKind; message: string } };
        if (gen !== genRef.current) return;
        if ("error" in data) {
          fail(data.error.kind, data.error.message);
          return;
        }
        commit(data.explanation, false, provider, settings.model);
        if (cacheKey) cacheRef.current.set(cacheKey, data.explanation);
      } catch (error) {
        if (gen !== genRef.current) return;
        fail(abortKind(error));
      }
    },
    [commit, fail, handleMockEvent, settings, effectiveProvider],
  );

  // Debounced trigger: explain the current snapshot after a short pause, and
  // cancel in-flight work as soon as the snapshot changes.
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => {
      void run(current, previous);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [current, previous, run]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const retry = useCallback(() => {
    if (current) void run(current, previous);
  }, [current, previous, run]);

  const clear = useCallback(() => {
    controllerRef.current?.abort();
    genRef.current += 1;
    cacheRef.current.clear();
    setState({
      explanation: null,
      streamingText: "",
      status: "idle",
      error: null,
      fromCache: false,
      provider: null,
      model: null,
      confidence: null,
    });
  }, []);

  return useMemo(
    () => {
      // With no snapshot selected there is nothing to explain — surface that as
      // an idle state without mutating state from an effect.
      const visibleState: AiExplainState = current
        ? state
        : { ...state, status: "idle", streamingText: "" };
      return {
        ...visibleState,
        settings,
        effectiveProvider,
        availability,
        setSettings,
        retry,
        clear,
      };
    },
    [current, state, settings, effectiveProvider, availability, setSettings, retry, clear],
  );
}

function abortKind(error: unknown): AIErrorKind {
  if (error instanceof Error && error.name === "AbortError") return "cancelled";
  return "network";
}

function maybeParse(text: string): Explanation | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Explanation;
    if (
      typeof parsed.summary === "string" &&
      typeof parsed.reason === "string" &&
      typeof parsed.concept === "string" &&
      typeof parsed.nextStep === "string" &&
      Array.isArray(parsed.changes) &&
      (parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low")
    ) {
      return parsed;
    }
  } catch {
    // not complete yet
  }
  return null;
}
