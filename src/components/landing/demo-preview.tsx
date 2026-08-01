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
  declaration: "bg-sky-400",
  assignment: "bg-indigo-400",
  condition: "bg-amber-400",
  loop: "bg-fuchsia-400",
  call: "bg-emerald-400",
  return: "bg-rose-400",
  console: "bg-zinc-200",
  other: "bg-zinc-600",
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
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-2xl shadow-black/40 backdrop-blur-xl">
      {/* Window chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="ml-2 text-xs text-zinc-400 font-medium">Interactive Demo</span>
        </div>

        {/* Snippet selector tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          {DEMO_SNIPPETS.map((snippet) => (
            <button
              key={snippet.id}
              type="button"
              onClick={() => setSelectedSnippetId(snippet.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                selectedSnippetId === snippet.id
                  ? "bg-sky-500/20 text-sky-300 font-semibold"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {snippet.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          {(["timeline", "graph"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                view === mode ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300",
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
          <pre className="rounded-xl border border-white/[0.06] bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300 font-mono overflow-x-auto">
            {activeSnippet.code}
          </pre>

          {/* Controls */}
          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(0)}
              aria-label="First step"
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-zinc-300 transition-colors hover:bg-white/[0.08]"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? "Pause" : "Play"}
              className="rounded-lg bg-sky-500 p-2 text-white transition-colors hover:bg-sky-400"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next step"
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-zinc-300 transition-colors hover:bg-white/[0.08]"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <span className="ml-1 text-[11px] tabular-nums text-zinc-500">
              step {index} / {snapshots.length - 1}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                  aiOpen
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-violet-500 text-white hover:bg-violet-400",
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
                    snapIndex === index ? "ring-2 ring-white/70" : "opacity-60 hover:opacity-100",
                  )}
                />
              );
            })}
          </div>

          {/* Console */}
          <div className="mt-3 min-h-10 rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[11px]">
            {!current || current.console.length === 0 ? (
              <span className="text-zinc-600">Console output appears here…</span>
            ) : (
              current.console.map((line, lineIndex) => (
                <div key={lineIndex} className="font-mono text-zinc-300">
                  <span className="mr-2 text-zinc-600">›</span>
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
                <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
                      AI explanation
                    </span>
                  </div>
                  {loadingAi ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-2.5 w-3/4 animate-pulse rounded bg-white/[0.08]" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.08]" />
                    </div>
                  ) : explanation ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs leading-relaxed text-zinc-200">{explanation.summary}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                          {explanation.concept}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            explanation.confidence === "high"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-amber-400/10 text-amber-300",
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
        <div className="flex min-h-0 flex-col gap-3 border-t border-white/[0.06] p-4 md:border-l md:border-t-0">
          <div className="min-h-0 flex-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Variables
            </h4>
            <div className="mt-2 space-y-1">
              {!current || Object.entries(current.variables).length === 0 ? (
                <p className="text-[11px] text-zinc-600">No bindings yet.</p>
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
                          ? "border-indigo-400/30 bg-indigo-400/[0.06]"
                          : added
                            ? "border-sky-400/30 bg-sky-400/[0.06]"
                            : "border-white/[0.05] bg-white/[0.02]",
                      )}
                    >
                      <span className="text-zinc-400">{name}</span>
                      <span className="font-mono text-zinc-200">{formatValue(value)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Heap
            </h4>
            <div className="mt-2 space-y-1">
              {!current || (current.heap ?? []).length === 0 ? (
                <p className="text-[11px] text-zinc-600">No heap allocations yet.</p>
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
                          ? "border-sky-400/40 bg-sky-400/[0.08]"
                          : changed
                            ? "border-amber-400/25 bg-amber-400/[0.05]"
                            : "border-white/[0.05] bg-white/[0.02]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sky-300">{node.id}</span>
                        <span className="text-zinc-600">{node.type}</span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-zinc-500">
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
            className="absolute inset-0 z-10 rounded-2xl border border-white/[0.07] bg-[#0a0c10] p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white">Execution graph</h4>
              <span className="text-[11px] text-zinc-500">
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
    <div className="relative h-64 overflow-hidden rounded-xl border border-white/[0.05] bg-black/30">
      <svg className="h-full w-full" viewBox={`0 0 ${totalWidth} ${totalHeight}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="demo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="#3f3f46" />
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
              stroke={onPath ? "#22d3ee" : "#3f3f46"}
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
                fill={isActive ? "rgba(56,189,248,0.18)" : onPath ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.03)"}
                stroke={isActive ? "#38bdf8" : onPath ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.1)"}
                strokeWidth={isActive ? 2 : 1}
              />
              <text
                x={8}
                y={22}
                fontSize={12}
                fill={isActive || onPath ? "#e4e4e7" : "#71717a"}
              >
                #{node.step}
              </text>
              <text x={8} y={40} fontSize={10} fill="#71717a">
                {node.line > 0 ? `line ${node.line}` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
