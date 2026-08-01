"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header, type EngineStatus } from "@/components/header";
import { EditorPane } from "@/components/editor-pane";
import { CallStackPanel } from "@/components/call-stack-panel";
import { HeapPanel } from "@/components/heap-panel";
import { VariablesPanel } from "@/components/variables-panel";
import { ConsolePanel } from "@/components/console-panel";
import { Controls } from "@/components/controls";
import { TimelinePanel } from "@/components/timeline/timeline-panel";
import { GraphPanel } from "@/components/graph/graph-panel";
import { WatchPanel } from "@/components/watch-panel";
import { SnapshotInspector } from "@/components/snapshot-inspector";
import { ViewTabs, type DebuggerView } from "@/components/view-tabs";
import { AiPanel } from "@/components/ai-panel";
import { AiSettingsDialog } from "@/components/ai-settings-dialog";
import { ShareDialog } from "@/components/session/share-dialog";
import { ExampleGallery } from "@/components/gallery/example-gallery";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { markTourSeen, shouldShowTour } from "@/components/onboarding/tour-state";
import { inspectSnapshot } from "@/debugger";
import type { PlaybackSpeed } from "@/debugger";
import { useCodeVisualizer } from "@/hooks/use-code-visualizer";
import { useTimeline } from "@/hooks/use-timeline";
import { useWatches } from "@/hooks/use-watches";
import { useAiExplain } from "@/hooks/use-ai-explain";
import { useSession } from "@/hooks/use-session";
import type { SessionContent } from "@/session";
import type { AIProviderKind } from "@/ai";
import { createLocalStorageStorage, getExampleById, recordRecent } from "@/examples";
import type { Example } from "@/examples";
import { cn } from "@/lib/utils";

const exampleStorage = createLocalStorageStorage();

interface CodeScopePlaygroundProps {
  /** Example id from the URL (`?example=…`), loaded once on mount. */
  initialExampleId?: string;
}

export function CodeScopePlayground({ initialExampleId }: CodeScopePlaygroundProps) {
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

  const watches = useWatches(current);
  const [view, setView] = useState<DebuggerView>("timeline");
  const [editorCursor, setEditorCursor] = useState<{ focused: boolean; line: number }>({
    focused: false,
    line: 1,
  });
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const ai = useAiExplain(current, snapshots[index - 1]);

  const timeline = useTimeline(snapshots, index, scrub, {
    searchWatches: watches.expressions,
    getBreakpointLine: () => (editorCursor.focused ? editorCursor.line : null),
  });

  const total = snapshots.length;
  const status: EngineStatus = !hasRun ? "idle" : error ? "error" : "completed";
  const stepCount = snapshots.length - 1;
  const activeLine = current && current.line > 0 ? current.line : null;

  // Project the whole workspace into a session content object. Depends on
  // stable values only (state references / primitives), never on the timeline
  // controller object, so the memo stays put across unrelated renders.
  const sessionContent = useMemo<SessionContent>(
    () => ({
      code,
      snapshotIndex: index,
      breakpoints: [...timeline.breakpoints].map(([line, bp]) => ({ line, enabled: bp.enabled })),
      watches: watches.expressions,
      view,
      playbackSpeed: timeline.speed,
      isPlaying: timeline.isPlaying,
      bookmarks: [...timeline.bookmarks],
      showMiniMap: timeline.showMiniMap,
      ai: {
        provider: ai.settings.provider,
        model: ai.settings.model,
        temperature: ai.settings.temperature,
        stream: ai.settings.stream,
        cacheEnabled: ai.settings.cacheEnabled,
      },
      theme: { theme: "dark", reducedMotion: false, density: "comfortable" },
      editor: { fontSize: 14, tabSize: 2, wordWrap: true, minimap: false, lineNumbers: true },
    }),
    [
      code,
      index,
      timeline.breakpoints,
      timeline.speed,
      timeline.isPlaying,
      timeline.bookmarks,
      timeline.showMiniMap,
      watches.expressions,
      view,
      ai.settings,
    ],
  );

  // Apply a restored session: replace the code, re-run to rebuild snapshots,
  // then seek to the remembered index and restore every panel's state.
  const { restore: restoreTimeline } = timeline;
  const { restore: restoreWatches } = watches;
  const { setSettings: setAiSettings } = ai;
  const applyContent = useCallback(
    (s: SessionContent) => {
      updateCode(s.code);
      restoreTimeline({
        breakpoints: s.breakpoints,
        bookmarks: new Set(s.bookmarks),
        speed: s.playbackSpeed as PlaybackSpeed,
        showMiniMap: s.showMiniMap,
      });
      restoreWatches(s.watches);
      setView(s.view);
      setAiSettings({
        provider: s.ai.provider as AIProviderKind,
        model: s.ai.model,
        temperature: s.ai.temperature,
        stream: s.ai.stream,
        cacheEnabled: s.ai.cacheEnabled,
      });
      run();
      scrub(s.snapshotIndex);
    },
    [updateCode, restoreTimeline, restoreWatches, setAiSettings, setView, run, scrub],
  );

  const session = useSession({ content: sessionContent, applyContent });

  // Apply a gallery example: replace the code, reset panels, run, and seek to
  // the start so the user can walk through the whole trace.
  const applyExample = useCallback(
    (example: Example) => {
      updateCode(example.sourceCode);
      restoreTimeline({ breakpoints: [], bookmarks: new Set(), speed: 1, showMiniMap: false });
      restoreWatches([]);
      run();
      scrub(0);
      recordRecent(exampleStorage, example.id);
    },
    [updateCode, restoreTimeline, restoreWatches, run, scrub],
  );

  // Load `?example=<id>` exactly once per id.
  const appliedExample = useRef<string | null>(null);
  useEffect(() => {
    if (!initialExampleId || appliedExample.current === initialExampleId) return;
    const example = getExampleById(initialExampleId);
    if (!example) return;
    appliedExample.current = initialExampleId;
    applyExample(example);
  }, [initialExampleId, applyExample]);

  // First-launch guided tour (skipped when arriving via an example link).
  const tourDismissed = useRef(false);
  useEffect(() => {
    if (initialExampleId || tourDismissed.current) return;
    if (shouldShowTour(exampleStorage)) {
      const timer = window.setTimeout(() => setTourOpen(true), 700);
      return () => window.clearTimeout(timer);
    }
  }, [initialExampleId]);

  const closeTour = useCallback(() => {
    markTourSeen(exampleStorage);
    tourDismissed.current = true;
    setTourOpen(false);
  }, []);

  // Inspector: derived from the current snapshot every step, hidden via state.
  const inspection = useMemo(
    () => (inspectorOpen && current ? inspectSnapshot(snapshots, index) : null),
    [inspectorOpen, current, snapshots, index],
  );

  return (
    <div className="relative flex h-dvh flex-col gap-3 p-3 md:p-4">
      <Header
        status={status}
        stepCount={stepCount}
        onOpenExamples={() => setGalleryOpen(true)}
        onOpenSession={() => setShareOpen(true)}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <EditorPane
          initialCode={code}
          onChange={updateCode}
          activeLine={activeLine}
          breakpointLines={timeline.breakpointLines}
          onToggleBreakpoint={timeline.toggleBreakpoint}
          stoppedOnBreakpoint={timeline.stoppedOnBreakpoint}
          onCursorLineChange={(line) => setEditorCursor((prev) => ({ ...prev, line }))}
          onFocusChange={(focused) => setEditorCursor((prev) => ({ ...prev, focused }))}
        />
        <div className="flex min-h-44 flex-col gap-3 lg:min-h-0 lg:w-[30%] lg:shrink-0">
          <div data-tour-step="6">
            <AiPanel
              className="h-[21rem] shrink-0"
              state={ai}
              settings={ai.settings}
              effectiveProvider={ai.effectiveProvider}
              availability={ai.availability}
              onRetry={ai.retry}
              onOpenSettings={() => setAiSettingsOpen(true)}
            />
          </div>
          <CallStackPanel
            frames={current?.callStack ?? []}
            currentFrame={current?.CurrentFrame}
            framesAdded={timeline.diff.framesAdded}
          />
          <div data-tour-step="4">
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
          </div>
          <WatchPanel
            className="h-56 shrink-0"
            controller={watches}
            hasRun={hasRun}
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

      <ViewTabs view={view} onViewChange={setView} count={hasRun ? total : 0} />

      <div className={cn("relative", view === "graph" ? "h-96" : "")}>
        <div
          className={cn(
            "flex flex-col gap-3",
            view === "timeline" ? "relative" : "pointer-events-none invisible absolute inset-0",
          )}
        >
          <ConsolePanel
            lines={current?.console ?? []}
            error={error}
            hasRun={hasRun}
            addedCount={timeline.diff.consoleAdded.length}
          />

          <TimelinePanel
            snapshots={snapshots}
            index={index}
            timeline={timeline}
            onSelect={scrub}
            onInspect={() => setInspectorOpen(true)}
          />
        </div>

        <div
          className={cn(
            "absolute inset-0",
            view === "graph" ? "" : "pointer-events-none invisible",
          )}
        >
          <GraphPanel
            snapshots={snapshots}
            error={error}
            index={index}
            timeline={timeline}
            onSelect={scrub}
            active={view === "graph"}
          />
        </div>
      </div>

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
        onContinue={timeline.continuePlayback}
        onStop={timeline.stopPlayback}
        onNextBreakpoint={timeline.jumpToNextBreakpoint}
        onPreviousBreakpoint={timeline.jumpToPreviousBreakpoint}
      />

      <SnapshotInspector inspection={inspection} onClose={() => setInspectorOpen(false)} />

      <AiSettingsDialog
        open={aiSettingsOpen}
        settings={ai.settings}
        availability={ai.availability}
        onSave={ai.setSettings}
        onClose={() => setAiSettingsOpen(false)}
      />

      <ShareDialog
        open={shareOpen}
        controller={session}
        onClose={() => setShareOpen(false)}
      />

      <ExampleGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onLoad={applyExample}
      />

      <GuidedTour open={tourOpen} onClose={closeTour} />
    </div>
  );
}
