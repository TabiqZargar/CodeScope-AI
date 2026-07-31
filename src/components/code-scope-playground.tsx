"use client";

import { Header, type EngineStatus } from "@/components/header";
import { EditorPane } from "@/components/editor-pane";
import { CallStackPanel } from "@/components/call-stack-panel";
import { HeapPanel } from "@/components/heap-panel";
import { VariablesPanel } from "@/components/variables-panel";
import { ConsolePanel } from "@/components/console-panel";
import { Controls } from "@/components/controls";
import { TimelinePanel } from "@/components/timeline/timeline-panel";
import { useCodeVisualizer } from "@/hooks/use-code-visualizer";
import { useTimeline } from "@/hooks/use-timeline";

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

  const timeline = useTimeline(snapshots, index, scrub);

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
        <div className="flex min-h-44 flex-col gap-3 lg:min-h-0 lg:w-[30%] lg:shrink-0">
          <CallStackPanel
            frames={current?.callStack ?? []}
            currentFrame={current?.CurrentFrame}
            framesAdded={timeline.diff.framesAdded}
          />
          <VariablesPanel
            className="min-h-0 flex-1"
            variables={current?.variables ?? {}}
            stepIndex={current?.index}
            condition={current?.condition}
            conditionResult={current?.conditionResult}
            loopType={current?.loopType}
            iteration={current?.iteration}
            diff={timeline.diff}
          />
          <HeapPanel
            className="shrink-0"
            heap={current?.heap}
            stepIndex={current?.index}
            addedIds={timeline.diff.heapAdded}
            changedIds={timeline.diff.heapChanged}
          />
        </div>
      </div>

      <ConsolePanel
        lines={current?.console ?? []}
        error={error}
        hasRun={hasRun}
        addedCount={timeline.diff.consoleAdded.length}
      />

      <TimelinePanel snapshots={snapshots} index={index} timeline={timeline} onSelect={scrub} />

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
      />
    </div>
  );
}
