"use client";

import { useCallback, useMemo, useState } from "react";
import { evaluateWatches } from "@/debugger";
import type { WatchEvalResult } from "@/debugger";
import type { Snapshot } from "@/engine";

export interface WatchItem {
  readonly id: string;
  readonly expression: string;
}

export interface WatchController {
  readonly watches: readonly WatchItem[];
  /** Just the expressions, in order (feeds search + evaluation). */
  readonly expressions: readonly string[];
  /** One evaluation result per watch, against the current snapshot. */
  readonly results: readonly WatchEvalResult[];
  addWatch: (expression: string) => void;
  updateWatch: (id: string, expression: string) => void;
  removeWatch: (id: string) => void;
  moveWatch: (id: string, delta: 1 | -1) => void;
  clearWatches: () => void;
  /** Replace every watch with the given expressions (session restore). */
  restore: (expressions: readonly string[]) => void;
}

let watchSequence = 0;
const nextWatchId = (): string => `watch-${++watchSequence}`;

/**
 * Watch panel state. Values are NEVER evaluated against the live runtime —
 * they are evaluated against the selected snapshot via `evaluateWatches`, so
 * results are recomputed in O(#watches) whenever the selection changes.
 */
export function useWatches(snapshot: Snapshot | null): WatchController {
  const [watches, setWatches] = useState<WatchItem[]>([]);

  const expressions = useMemo(() => watches.map((watch) => watch.expression), [watches]);
  const results = useMemo(
    () => evaluateWatches(expressions, snapshot),
    [expressions, snapshot],
  );

  const addWatch = useCallback((expression: string) => {
    const trimmed = expression.trim();
    if (!trimmed) return;
    setWatches((prev) => [...prev, { id: nextWatchId(), expression: trimmed }]);
  }, []);

  const updateWatch = useCallback((id: string, expression: string) => {
    const trimmed = expression.trim();
    setWatches((prev) =>
      prev.map((watch) => (watch.id === id ? { ...watch, expression: trimmed || watch.expression } : watch)),
    );
  }, []);

  const removeWatch = useCallback((id: string) => {
    setWatches((prev) => prev.filter((watch) => watch.id !== id));
  }, []);

  const moveWatch = useCallback((id: string, delta: 1 | -1) => {
    setWatches((prev) => {
      const from = prev.findIndex((watch) => watch.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }, []);

  const clearWatches = useCallback(() => {
    setWatches([]);
  }, []);

  const restore = useCallback((expressions: readonly string[]) => {
    setWatches(
      expressions
        .map((expression) => expression.trim())
        .filter((expression) => expression.length > 0)
        .map((expression) => ({ id: nextWatchId(), expression })),
    );
  }, []);

  return {
    watches,
    expressions,
    results,
    addWatch,
    updateWatch,
    removeWatch,
    moveWatch,
    clearWatches,
    restore,
  };
}
