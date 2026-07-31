"use client";

import { Header, type EngineStatus } from "@/components/header";
import { EditorPane } from "@/components/editor-pane";
import { VariablesPanel } from "@/components/variables-panel";
import { ConsolePanel } from "@/components/console-panel";
import { Controls } from "@/components/controls";
import { useCodeVisualizer } from "@/hooks/use-code-visualizer";

export function CodeScopePlayground() {
  const {
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
  } = useCodeVisualizer();

  const total = snapshots.length;
  const status: EngineStatus = !hasRun ? "idle" : error ? "error" : "completed";
  const stepCount = snapshots.length - 1;
  const activeLine = current && current.line > 0 ? current.line : null;

  return (
    <div className="relative flex h-dvh flex-col gap-3 p-3 md:p-4">
      <Header status={status} stepCount={stepCount} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <EditorPane
          initialCode={code}
          onChange={updateCode}
          activeLine={activeLine}
        />
        <div className="flex min-h-44 flex-col lg:min-h-0 lg:w-[30%] lg:shrink-0">
          <VariablesPanel variables={current?.variables ?? {}} />
        </div>
      </div>

      <ConsolePanel lines={current?.console ?? []} error={error} hasRun={hasRun} />

      <Controls
        hasRun={hasRun}
        currentIndex={index}
        total={Math.max(total, 1)}
        canPrev={canPrev}
        canNext={canNext}
        onRun={run}
        onPrev={prev}
        onNext={next}
        onReset={reset}
        onScrub={scrub}
      />
    </div>
  );
}
