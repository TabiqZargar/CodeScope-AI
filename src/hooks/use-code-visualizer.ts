"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runCode, DEFAULT_CODE, type ExecutionError, type ExecutionResult, type Snapshot } from "@/engine";

/**
 * Owns the visualizer state machine.
 *
 *   - Run:     execute current code → immutable timeline → land on the final step
 *   - Prev/Next / scrub: move through the timeline
 *   - Reset:   clear execution state and return to editing
 *   - Edit:    invalidate any previous run (snapshots would be stale)
 */
export function useCodeVisualizer() {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [index, setIndex] = useState(0);

  const codeRef = useRef(code);

  const snapshots = useMemo(() => result?.snapshots ?? [], [result]);
  const lastIndex = Math.max(snapshots.length - 1, 0);

  const current: Snapshot | null = useMemo(
    () => (snapshots.length > 0 ? snapshots[Math.min(index, snapshots.length - 1)] : null),
    [snapshots, index],
  );

  const error: ExecutionError | null = result && !result.ok ? result.error : null;
  const hasRun = result !== null;

  const updateCode = useCallback((next: string) => {
    setCode(next);
    codeRef.current = next;
    setResult(null);
    setIndex(0);
  }, []);

  const run = useCallback(() => {
    const execution = runCode(codeRef.current);
    setResult(execution);
    setIndex(execution.snapshots.length - 1);
  }, []);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, lastIndex));
  }, [lastIndex]);

  const scrub = useCallback(
    (target: number) => {
      setIndex(Math.min(Math.max(target, 0), lastIndex));
    },
    [lastIndex],
  );

  const reset = useCallback(() => {
    setResult(null);
    setIndex(0);
  }, []);

  const canPrev = index > 0;
  const canNext = hasRun && snapshots.length > 0 && index < lastIndex;

  // Keyboard shortcuts. Single-key shortcuts are ignored while the cursor is
  // inside the editor so typing is never hijacked.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.closest?.(".monaco-editor") != null);

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run();
        return;
      }

      if (isTyping) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case "Escape":
        case "r":
        case "R":
          reset();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [run, next, prev, reset]);

  return {
    code,
    snapshots,
    current,
    index,
    error,
    hasRun,
    canPrev,
    canNext,
    updateCode,
    run,
    prev,
    next,
    scrub,
    reset,
  };
}
