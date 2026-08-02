"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GitGraph, History, Pause, Play, SkipBack, SkipForward, Sparkles } from "lucide-react";
import { formatValue, runCode } from "@/engine";
import {
  buildExecutionGraph,
  classifyTimeline,
  computeDiff,
  isGraphEdgeOnPath,
  isGraphNodeOnPath,
  layoutExecutionGraph,
} from "@/debugger";
import type { ExecutionGraph, ExecutionGraphLayout, SnapshotType } from "@/debugger";
import { createInMemoryCache, explainSnapshot } from "@/ai";
import type { Explanation } from "@/ai";
import { graphColors, tokens } from "@/styles/tokens";
import { cn } from "@/lib/utils";

const DEMO_SNIPPETS = [
  {
    id: "cart",
    label: "Shopping Cart",
    code: `let cart = [];
let total = 0;
cart.push("book");
cart.push("pen");
for (let i = 0; i < cart.length; i++) {
  total = total + 1;
}
console.log("Items: " + cart.length);
console.log("Total: " + total);`,
  },
  {
    id: "counter",
    label: "Loop Accumulator",
    code: `let sum = 0;
for (let i = 1; i <= 4; i++) {
  sum = sum + i;
}
console.log("Sum: " + sum);`,
  },
  {
    id: "conditionals",
    label: "Conditionals",
    code: `let score = 85;
let tier = "bronze";
if (score >= 90) {
  tier = "gold";
} else if (score >= 80) {
  tier = "silver";
}
console.log("Tier: " + tier);`,
  },
];

const TYPE_STYLES: Record<SnapshotType, string> = {
  declaration: "bg-primary",
  assignment: "bg-secondary",
  condition: "bg-conditions",
  loop: "bg-loops",
  call: "bg-functions",
  return: "bg-heap",
  console: "bg-console",
  other: "bg-ink-disabled",
};

type DemoView = "timeline" | "graph";

export function DemoPreview() {
  const [selectedSnippetId, setSelectedSnippetId] = useState("cart");
  const activeSnippet = DEMO_SNIPPETS.find((s) => s.id === selectedSnippetId) || DEMO_SNIPPETS[0];

  const result = useMemo(() => runCode(activeSnippet.code), [activeSnippet.code]);
  const snapshots = useMemo(() => result.snapshots, [result]);
  const types = useMemo(() => classifyTimeline(snapshots), [snapshots]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<DemoView>("timeline");
  const [aiOpen, setAiOpen] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Reset index when snippet changes using derived state pattern
  const [prevSnippetId, setPrevSnippetId] = useState(selectedSnippetId);
  if (prevSnippetId !== selectedSnippetId) {
    setPrevSnippetId(selectedSnippetId);
    setIndex(0);
    setPlaying(false);
  }

  const current = snapshots[index] || snapshots[0];
  const diff = useMemo(() => computeDiff(snapshots[index - 1], current), [snapshots, index, current]);

  const graph = useMemo(
    () => buildExecutionGraph(snapshots, result.ok ? undefined : result.error),
    [snapshots, result],
  );
  const layout = useMemo(() => layoutExecutionGraph(graph), [graph]);

  const goTo = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(snapshots.length - 1, next))),
    [snapshots.length],
  );

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setIndex((currentIndex) => {
        if (currentIndex >= snapshots.length - 1) {
          setPlaying(false);
          return currentIndex;
        }
        return currentIndex + 1;
      });
    }, 350);
    return () => window.clearInterval(timer);
  }, [playing, snapshots.length]);

  const cache = useMemo(() => createInMemoryCache(), []);
  const [prevAiState, setPrevAiState] = useState({ open: aiOpen, index, snippet: selectedSnippetId });
  if (prevAiState.open !== aiOpen || prevAiState.index !== index || prevAiState.snippet !== selectedSnippetId) {
    setPrevAiState({ open: aiOpen, index, snippet: selectedSnippetId });
    if (aiOpen) {
      setLoadingAi(true);
      setExplanation(null);
    }
  }
  useEffect(() => {
    if (!aiOpen) return;
    let cancelled = false;
    explainSnapshot({
      snapshot: current,
      previous: snapshots[index - 1],
      provider: "mock",
      model: "codescope-mock",
      temperature: 0.2,
      stream: false,
      cache,
    })
      .then((explained) => {
        if (!cancelled) setExplanation(explained.explanation);
      })
      .finally(() => {
        if (!cancelled) setLoadingAi(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOpen, index, selectedSnippetId]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-glass shadow-panel backdrop-blur-xl">
      {/* Window chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
          </div>
          <span className="ml-2 text-xs font-medium text-ink-muted">Interactive Demo</span>
        </div>

        {/* Snippet selector tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface-glass p-0.5">
          {DEMO_SNIPPETS.map((snippet) => (
            <button
              key={snippet.id}
              type="button"
              onClick={() => setSelectedSnippetId(snippet.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                selectedSnippetId === snippet.id
                  ? "bg-primary/[0.15] font-semibold text-primary"
                  : "text-ink-muted hover:text-ink-secondary",
              )}
            >
              {snippet.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface-glass p-0.5">
          {(["timeline", "graph"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                view === mode ? "bg-surface-hover text-ink-primary" : "text-ink-muted hover:text-ink-secondary",
              )}
            >
              {mode === "timeline" ? (
                <History className="h-3 w-3" />
              ) : (
                <GitGraph className="h-3 w-3" />
              )}
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_260px]">
        <div className="flex min-h-0 flex-col p-4">
          {/* Code */}
          <pre className="overflow-x-auto rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
            {activeSnippet.code}
          </pre>

          {/* Controls */}
          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(0)}
              aria-label="First step"
              className="rounded-lg border border-line-strong bg-surface-glass p-2 text-ink-secondary transition-colors hover:bg-surface-hover"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? "Pause" : "Play"}
              className="btn-primary rounded-lg p-2"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next step"
              className="rounded-lg border border-line-strong bg-surface-glass p-2 text-ink-secondary transition-colors hover:bg-surface-hover"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <span className="ml-1 text-[11px] tabular-nums text-ink-muted">
              step {index} / {snapshots.length - 1}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                  aiOpen
                    ? "bg-ai/[0.15] text-ai"
                    : "bg-ai text-white hover:bg-ai/90",
                )}
              >
                <Sparkles className="h-3 w-3" />
                Ask AI
              </button>
            </div>
          </div>

          {/* Timeline strip */}
          <div className="mt-3 flex items-end gap-[3px] overflow-x-auto pb-1">
            {snapshots.slice(1).map((snapshot) => {
              const snapIndex = snapshot.index;
              const type = types[snapIndex] ?? "other";
              return (
                <button
                  key={snapshot.index}
                  type="button"
                  onClick={() => goTo(snapIndex)}
                  aria-label={`Go to step ${snapIndex}`}
                  className={cn(
                    "h-4 w-2.5 shrink-0 rounded-sm transition-all",
                    TYPE_STYLES[type],
                    snapIndex === index ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100",
                  )}
                />
              );
            })}
          </div>

          {/* Console */}
          <div className="mt-3 min-h-10 rounded-xl border border-line bg-bg-primary/60 p-3 text-[11px]">
            {!current || current.console.length === 0 ? (
              <span className="text-ink-disabled">Console output appears here…</span>
            ) : (
              current.console.map((line, lineIndex) => (
                <div key={lineIndex} className="font-mono text-ink-secondary">
                  <span className="mr-2 text-ink-disabled">›</span>
                  {line}
                </div>
              ))
            )}
          </div>

          {/* AI explanation */}
          <AnimatePresence>
            {aiOpen ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-xl border border-ai/20 bg-ai/[0.06] p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-ai" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ai">
                      AI explanation
                    </span>
                  </div>
                  {loadingAi ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-2.5 w-3/4 animate-pulse rounded bg-surface-hover" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-hover" />
                    </div>
                  ) : explanation ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs leading-relaxed text-ink-secondary">{explanation.summary}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-ink-muted">
                          {explanation.concept}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            explanation.confidence === "high"
                              ? "bg-success/10 text-success"
                              : "bg-warning/10 text-warning",
                          )}
                        >
                          confidence: {explanation.confidence}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Right column: variables + heap */}
        <div className="flex min-h-0 flex-col gap-3 border-t border-line p-4 md:border-l md:border-t-0">
          <div className="min-h-0 flex-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-ink-disabled">
              Variables
            </h4>
            <div className="mt-2 space-y-1">
              {!current || Object.entries(current.variables).length === 0 ? (
                <p className="text-[11px] text-ink-disabled">No bindings yet.</p>
              ) : (
                Object.entries(current.variables).map(([name, value]) => {
                  const changed = diff.changedVariables.some((entry) => entry.name === name);
                  const added = diff.addedVariables.includes(name);
                  return (
                    <div
                      key={name}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px]",
                        changed
                          ? "border-primary/30 bg-primary/[0.06]"
                          : added
                            ? "border-secondary/30 bg-secondary/[0.06]"
                            : "border-line bg-surface-glass",
                      )}
                    >
                      <span className="text-ink-muted">{name}</span>
                      <span className="font-mono text-ink-primary">{formatValue(value)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-ink-disabled">
              Heap
            </h4>
            <div className="mt-2 space-y-1">
              {!current || (current.heap ?? []).length === 0 ? (
                <p className="text-[11px] text-ink-disabled">No heap allocations yet.</p>
              ) : (
                (current.heap ?? []).map((node) => {
                  const changed = diff.heapChanged.includes(node.id) || diff.heapAdded.includes(node.id);
                  return (
                    <div
                      key={node.id}
                      onMouseEnter={() => setHoverId(node.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors",
                        hoverId === node.id
                          ? "border-secondary/40 bg-secondary/[0.08]"
                          : changed
                            ? "border-loops/25 bg-loops/[0.05]"
                            : "border-line bg-surface-glass",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-secondary">{node.id}</span>
                        <span className="text-ink-disabled">{node.type}</span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-ink-muted">
                        {formatValue(node)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Graph view */}
      <AnimatePresence>
        {view === "graph" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 rounded-2xl border border-line-strong bg-canvas-elevated p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-ink-primary">Execution graph</h4>
              <span className="text-[11px] text-ink-muted">
                {graph.nodeCount} nodes · {graph.edgeCount} edges
              </span>
            </div>
            <MiniGraph graph={graph} layout={layout} activeIndex={index} onSelect={goTo} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Compact graph renderer: edges as lines, nodes as small labelled boxes. */
function MiniGraph({
  graph,
  layout,
  activeIndex,
  onSelect,
}: {
  graph: ExecutionGraph;
  layout: ExecutionGraphLayout;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const padding = 8;
  const totalWidth = layout.width + padding * 2;
  const totalHeight = layout.height + padding * 2;

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const positioned of layout.nodes) {
      map.set(positioned.node.id, positioned);
    }
    return map;
  }, [layout]);

  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-line bg-canvas">
      <svg className="h-full w-full" viewBox={`0 0 ${totalWidth} ${totalHeight}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="demo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill={graphColors.edgeOffPathMarker} />
          </marker>
        </defs>
        {graph.edges.map((edge) => {
          const from = positions.get(edge.fromId);
          const to = positions.get(edge.toId);
          if (!from || !to) return null;
          const onPath = isGraphEdgeOnPath(edge, activeIndex);
          return (
            <line
              key={edge.id}
              x1={from.x + from.width / 2 + padding}
              y1={from.y + from.height + padding}
              x2={to.x + to.width / 2 + padding}
              y2={to.y + padding}
              stroke={onPath ? tokens.secondary : graphColors.edgeOffPath}
              strokeWidth={onPath ? 1.6 : 1}
              markerEnd="url(#demo-arrow)"
            />
          );
        })}
        {layout.nodes.map((positioned) => {
          const { node } = positioned;
          const isActive = node.snapshotIndex === activeIndex;
          const onPath = isGraphNodeOnPath(node, activeIndex);
          return (
            <g
              key={node.id}
              transform={`translate(${positioned.x + padding}, ${positioned.y + padding})`}
              onClick={() => node.snapshotIndex >= 0 && onSelect(node.snapshotIndex)}
              className="cursor-pointer"
            >
              <rect
                width={positioned.width}
                height={positioned.height}
                rx={10}
                fill={isActive ? graphColors.nodeFillCurrent : onPath ? graphColors.nodeFillPath : graphColors.nodeFill}
                stroke={isActive ? tokens.primary : onPath ? graphColors.nodeStroke : tokens.border.default}
                strokeWidth={isActive ? 2 : 1}
              />
              <text
                x={8}
                y={22}
                fontSize={12}
                fill={isActive || onPath ? tokens.text.secondary : tokens.text.disabled}
              >
                #{node.step}
              </text>
              <text x={8} y={40} fontSize={10} fill={tokens.text.disabled}>
                {node.line > 0 ? `line ${node.line}` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
