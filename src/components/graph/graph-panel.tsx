"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type NodeMouseHandler,
  type OnInit,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitGraph, Map as MapIcon, Maximize2 } from "lucide-react";
import {
  buildExecutionGraph,
  filterExecutionGraph,
  graphSelection,
  isGraphEdgeOnPath,
  isGraphNodeOnPath,
  layoutExecutionGraph,
} from "@/debugger";
import type { ExecutionGraphEdge, ExecutionGraphNode, ExecutionNodeKind, GraphEdgeKind } from "@/debugger";
import type { ExecutionError, Snapshot } from "@/engine";
import type { TimelineController } from "@/hooks/use-timeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { TimelineSearch } from "@/components/timeline/timeline-search";
import { GraphFilters } from "./graph-filters";
import { GraphHoverCard } from "./graph-hover-card";
import { GraphStepNodeView } from "./graph-step-node";
import type { GraphStepNode } from "./graph-step-node";

const NODE_TYPES = { step: GraphStepNodeView };

const EDGE_COLORS: Record<GraphEdgeKind, string> = {
  next: "#71717a",
  branch: "#34d399",
  loop: "#a78bfa",
  call: "#22d3ee",
  return: "#fbbf24",
};

function edgeColor(edge: ExecutionGraphEdge): string {
  if (edge.kind === "branch") return edge.label === "TRUE" ? "#34d399" : "#fb7185";
  return EDGE_COLORS[edge.kind];
}

const NODE_COLORS: Record<ExecutionNodeKind, string> = {
  declaration: "#38bdf8",
  assignment: "#fbbf24",
  condition: "#34d399",
  loop: "#a78bfa",
  call: "#22d3ee",
  return: "#fb7185",
  console: "#e879f9",
  other: "#71717a",
  error: "#f43f5e",
};

interface GraphPanelProps {
  snapshots: readonly Snapshot[];
  error: ExecutionError | null;
  /** Current debugger step; the single source of truth for selection. */
  index: number;
  timeline: TimelineController;
  /** Move the debugger to a snapshot (timeline and graph stay in sync). */
  onSelect: (index: number) => void;
  /** True when this view is the visible tab (refits the canvas then). */
  active: boolean;
}

interface HoverState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * The Execution Graph view: a control-flow canvas built entirely from the
 * existing immutable snapshots. State is derived (build → filter → layout →
 * selection) and memoized per input, so switching between the Timeline and
 * Graph tabs never re-processes anything.
 */
export function GraphPanel({
  snapshots,
  error,
  index,
  timeline,
  onSelect,
  active,
}: GraphPanelProps) {
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<ExecutionNodeKind>>(new Set());
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const instanceRef = useRef<ReactFlowInstance<GraphStepNode> | null>(null);

  // Memoized pipeline: nothing below re-runs unless its input changed.
  const graph = useMemo(() => buildExecutionGraph(snapshots, error), [snapshots, error]);
  const filtered = useMemo(
    () => filterExecutionGraph(graph, hiddenKinds),
    [graph, hiddenKinds],
  );
  const layout = useMemo(() => layoutExecutionGraph(filtered), [filtered]);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph],
  );

  const toggleKind = useCallback((kind: ExecutionNodeKind) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const fitView = useCallback(() => {
    void instanceRef.current?.fitView({ padding: 0.15 });
  }, []);

  // When this view becomes visible, refit so the newly-sized canvas shows the
  // whole graph (the container changes height when the tab is switched).
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => {
      void instanceRef.current?.fitView({ padding: 0.15 });
    }, 60);
    return () => window.clearTimeout(id);
  }, [active, layout]);

  const onInit = useCallback<OnInit<GraphStepNode, Edge>>((instance) => {
    instanceRef.current = instance;
  }, []);

  const onNodeClick = useCallback<NodeMouseHandler<GraphStepNode>>(
    (_, node) => {
      const snapshotIndex = node.data.snapshotIndex;
      if (snapshotIndex >= 0) onSelect(snapshotIndex);
    },
    [onSelect],
  );

  const onNodeMouseEnter = useCallback<NodeMouseHandler<GraphStepNode>>((event, node) => {
    setHovered({ id: node.id, x: event.clientX, y: event.clientY });
  }, []);

  const onNodeMouseLeave = useCallback(() => setHovered(null), []);

  const nodes = useMemo(
    () =>
      layout.nodes.map(({ node, x, y, width, height }) => ({
        id: node.id,
        type: "step" as const,
        position: { x, y },
        width,
        height,
        selected: graphSelection(filtered, index).has(node.id),
        data: {
          snapshotIndex: node.snapshotIndex,
          step: node.step,
          line: node.line,
          description: node.description,
          kind: node.kind,
          conditionResult: node.conditionResult,
          isCurrent: node.snapshotIndex === index,
          isOnPath: isGraphNodeOnPath(node, index),
          isMatch: node.snapshotIndex >= 0 && timeline.matched.has(node.snapshotIndex),
          hasBreakpoint:
            node.snapshotIndex >= 0 &&
            node.line > 0 &&
            timeline.breakpointLines.has(node.line),
        },
      })),
    [layout, filtered, index, timeline.matched, timeline.breakpointLines],
  );

  const edges = useMemo(
    () =>
      filtered.edges.map((edge) => {
        const onPath = isGraphEdgeOnPath(edge, index);
        const color = edgeColor(edge);
        return {
          id: edge.id,
          source: edge.fromId,
          target: edge.toId,
          label: edge.label,
          style: {
            stroke: onPath ? color : "rgba(255,255,255,0.08)",
            strokeWidth: onPath ? 1.6 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: onPath ? color : "rgba(255,255,255,0.16)",
            width: 14,
            height: 14,
          },
          labelStyle: {
            fill: onPath ? color : "#52525b",
            fontSize: 10,
            fontWeight: 700,
          },
          labelBgStyle: { fill: "#18181b", fillOpacity: 0.9, rx: 4 },
        };
      }),
    [filtered, index],
  );

  const hoverNode: ExecutionGraphNode | undefined = hovered ? nodeById.get(hovered.id) : undefined;

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-2">
          <GitGraph className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-200">Execution Graph</span>
          {snapshots.length > 0 && (
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500 tabular-nums">
              {graph.nodeCount} {graph.nodeCount === 1 ? "node" : "nodes"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TimelineSearch
            query={timeline.query}
            onQueryChange={timeline.setQuery}
            matchedCount={timeline.matchedCount}
            total={snapshots.length}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowMiniMap((prev) => !prev)}
            aria-label="Toggle mini map"
            title="Toggle mini map"
            className={cn(showMiniMap && "bg-white/[0.1] text-emerald-300")}
          >
            <MapIcon className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" size="sm" onClick={fitView} aria-label="Fit view" title="Fit view">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2">
        <GraphFilters hiddenKinds={hiddenKinds} onToggle={toggleKind} />
        {hiddenKinds.size > 0 && (
          <button
            type="button"
            onClick={() => setHiddenKinds(new Set())}
            className="text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {snapshots.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <GitGraph className="h-6 w-6 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-500">No execution graph yet</p>
            <p className="text-xs text-zinc-600">
              Run your code to trace its control flow.
            </p>
          </div>
        ) : (
          <ReactFlow<GraphStepNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            colorMode="dark"
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.05}
            maxZoom={2.5}
            onlyRenderVisibleElements
            proOptions={{ hideAttribution: true }}
            onInit={onInit}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,0.06)" />
            {showMiniMap && (
              <MiniMap
                pannable
                zoomable
                maskColor="rgba(0,0,0,0.65)"
                nodeStrokeWidth={2}
                nodeColor={(node) => {
                  const kind = (node.data as GraphStepNode["data"]).kind;
                  return NODE_COLORS[kind];
                }}
              />
            )}
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        )}
      </div>

      {hovered && hoverNode && (
        <GraphHoverCard node={hoverNode} snapshots={snapshots} x={hovered.x} y={hovered.y} />
      )}
    </Panel>
  );
}
