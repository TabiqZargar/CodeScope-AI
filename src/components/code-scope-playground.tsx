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
  const [rightSidebarTab, setRightSidebarTab] = useState<"stack" | "vars" | "watch" | "heap">("vars");
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

  const appliedExample = useRef<string | null>(null);
  useEffect(() => {
    if (!initialExampleId || appliedExample.current === initialExampleId) return;
    const example = getExampleById(initialExampleId);
    if (!example) return;
    appliedExample.current = initialExampleId;
    applyExample(example);
  }, [initialExampleId, applyExample]);

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

  const inspection = useMemo(
    () => (inspectorOpen && current ? inspectSnapshot(snapshots, index) : null),
    [inspectorOpen, current, snapshots, index],
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink-primary">
      <header className="shrink-0 border-b border-line bg-canvas">
        <Header
          status={status}
          stepCount={stepCount}
          onOpenExamples={() => setGalleryOpen(true)}
          onOpenSession={() => setShareOpen(true)}
        />
      </header>

      {/* Main dashboard: bounded grid shell. Each column is a min-h-0 flex
          column; every panel owns its own scroll area. Below xl the sections
          stack and the whole main scrolls; at xl+ the single row is locked to
          the viewport (1fr) so nothing ever grows beyond the fold. */}
      <main className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 p-3 overflow-y-auto md:p-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(500px,1fr)_360px] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden 2xl:grid-cols-[300px_minmax(600px,1fr)_380px]">

        {/* Left Sidebar: Editor & ViewTabs */}
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
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
          </div>
          <div className="shrink-0 pt-1">
            <ViewTabs view={view} onViewChange={setView} count={hasRun ? total : 0} />
          </div>
        </section>

        {/* Center Main: pinned AI header, scrollable timeline/graph area, pinned Controls */}
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
          <div data-tour-step="6" className="shrink-0">
            <AiPanel
              className="h-56"
              state={ai}
              settings={ai.settings}
              effectiveProvider={ai.effectiveProvider}
              availability={ai.availability}
              onRetry={ai.retry}
              onOpenSettings={() => setAiSettingsOpen(true)}
            />
          </div>

          <div
            className={cn(
              "relative min-h-[280px] flex-1",
              view === "timeline" ? "overflow-y-auto" : "overflow-hidden",
            )}
          >
            <div
              className={cn(
                "flex flex-col gap-3",
                view === "timeline" ? "flex" : "hidden",
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
                "h-full w-full",
                view === "graph" ? "block" : "hidden",
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

          <div className="shrink-0 pt-1">
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
          </div>
        </section>

        {/* Right Sidebar: Call Stack, Variables, Watch, Heap (Collapsible tabs on 1024-1439px, full column >=1440px) */}
        <aside className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto lg:col-span-2 xl:col-span-1">
          {/* Responsive tab selector for mid-screens (1024px to 1439px) */}
          <div className="flex shrink-0 gap-1 rounded-xl border border-line bg-surface-glass p-1 xl:hidden">
            <button
              type="button"
              onClick={() => setRightSidebarTab("vars")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-colors",
                rightSidebarTab === "vars" ? "bg-primary/[0.15] text-ink-primary ring-1 ring-inset ring-primary/30" : "text-ink-muted hover:text-ink-secondary",
              )}
            >
              Variables
            </button>
            <button
              type="button"
              onClick={() => setRightSidebarTab("watch")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-colors",
                rightSidebarTab === "watch" ? "bg-primary/[0.15] text-ink-primary ring-1 ring-inset ring-primary/30" : "text-ink-muted hover:text-ink-secondary",
              )}
            >
              Watch
            </button>
            <button
              type="button"
              onClick={() => setRightSidebarTab("heap")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-colors",
                rightSidebarTab === "heap" ? "bg-primary/[0.15] text-ink-primary ring-1 ring-inset ring-primary/30" : "text-ink-muted hover:text-ink-secondary",
              )}
            >
              Heap
            </button>
            <button
              type="button"
              onClick={() => setRightSidebarTab("stack")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-colors",
                rightSidebarTab === "stack" ? "bg-primary/[0.15] text-ink-primary ring-1 ring-inset ring-primary/30" : "text-ink-muted hover:text-ink-secondary",
              )}
            >
              Stack
            </button>
          </div>

          {/* Full stack for >=1440px (xl:grid), tabbed for 1024-1439px */}
          <div className={cn("xl:flex xl:flex-col xl:gap-3", rightSidebarTab === "stack" ? "flex flex-col gap-3" : "hidden xl:flex")}>
            <CallStackPanel
              frames={current?.callStack ?? []}
              currentFrame={current?.CurrentFrame}
              framesAdded={timeline.diff.framesAdded}
            />
          </div>

          <div className={cn("xl:flex xl:flex-col xl:gap-3", rightSidebarTab === "vars" ? "flex flex-col gap-3" : "hidden xl:flex")} data-tour-step="4">
            <VariablesPanel
              className="min-h-[220px]"
              variables={current?.variables ?? {}}
              stepIndex={current?.index}
              condition={current?.condition}
              conditionResult={current?.conditionResult}
              loopType={current?.loopType}
              iteration={current?.iteration}
              diff={timeline.diff}
            />
          </div>

          <div className={cn("xl:flex xl:flex-col xl:gap-3", rightSidebarTab === "watch" ? "flex flex-col gap-3" : "hidden xl:flex")}>
            <WatchPanel
              className="h-48 shrink-0"
              controller={watches}
              hasRun={hasRun}
            />
          </div>

          <div className={cn("xl:flex xl:flex-col xl:gap-3", rightSidebarTab === "heap" ? "flex flex-col gap-3" : "hidden xl:flex")}>
            <HeapPanel
              className="shrink-0"
              heap={current?.heap}
              stepIndex={current?.index}
              addedIds={timeline.diff.heapAdded}
              changedIds={timeline.diff.heapChanged}
            />
          </div>
        </aside>

      </main>

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
