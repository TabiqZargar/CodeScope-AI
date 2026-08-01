import dagre from "@dagrejs/dagre";
import type { ExecutionError, Snapshot } from "../engine";
import { classifySnapshot } from "./snapshot-type";
import type { SnapshotType } from "./snapshot-type";

/**
 * Execution graph — pure, React-free control-flow model.
 *
 * Everything here is derived from the existing immutable snapshots (plus, at
 * most, the ExecutionError for the terminal failure node). It never touches
 * the interpreter or snapshot generation: a node per snapshot, directed edges
 * between consecutive snapshots with semantics inferred from the pair
 * (branches, loop back-edges, call/return, plain next).
 *
 * The layer is intentionally dumb and testable: build → filter → lay out →
 * overlay. React components only map the result onto a canvas.
 */

/** Node kinds rendered by the graph. Reuses timeline types, plus `error`. */
export type ExecutionNodeKind = SnapshotType | "error";

/** Node id for a timeline snapshot; the single source of truth is its index. */
export function nodeIdFor(index: number): string {
  return `step-${index}`;
}

/** Id of the synthesized terminal failure node (no backing snapshot). */
export const ERROR_NODE_ID = "error";

/** Fixed node size used for layout (dagre needs dimensions up front). */
export const GRAPH_NODE_WIDTH = 200;
export const GRAPH_NODE_HEIGHT = 72;

/**
 * One graph node. Each snapshot yields exactly one node; the `error` node is
 * synthesized only when execution failed (derived from ExecutionError).
 */
export interface ExecutionGraphNode {
  /** Stable node id: `step-<index>` or `error`. */
  readonly id: string;
  /** Timeline index this node represents; -1 for the synthesized error node. */
  readonly snapshotIndex: number;
  /** 1-based step number (timeline index + 1). */
  readonly step: number;
  /** 1-based source line (0 when unknown). */
  readonly line: number;
  /** Snapshot description (or the error message, for the error node). */
  readonly description: string;
  readonly kind: ExecutionNodeKind;
  readonly condition?: string;
  readonly conditionResult?: boolean;
  readonly loopType?: Snapshot["loopType"];
  readonly iteration?: number;
  /**
   * Extension point for future overlays: breakpoints, watch expressions,
   * execution cost, AI annotations. Filled in by {@link overlayGraph}.
   */
  readonly overlays: readonly GraphOverlay[];
}

/** Directed edge semantics. */
export type GraphEdgeKind = "next" | "branch" | "loop" | "call" | "return";

/** One directed edge between two graph nodes. */
export interface ExecutionGraphEdge {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  /** Timeline index of the endpoints (-1 for the synthesized error node). */
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly kind: GraphEdgeKind;
  /** Display label: TRUE / FALSE / enter / loop / call / return / error. */
  readonly label?: string;
  readonly overlays: readonly GraphOverlay[];
}

/** A complete graph over one execution. */
export interface ExecutionGraph {
  readonly nodes: readonly ExecutionGraphNode[];
  readonly edges: readonly ExecutionGraphEdge[];
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly hasError: boolean;
  /** Reference to the snapshots the graph was built from (never copied). */
  readonly snapshots: readonly Snapshot[];
}

/** Result of {@link deriveEdgeInfo} for a snapshot pair. */
export interface GraphEdgeInfo {
  readonly kind: GraphEdgeKind;
  readonly label?: string;
}

/**
 * Extension point for future graph overlays. Not rendered yet; `overlayGraph`
 * attaches them to matching nodes so later features (breakpoints, watch,
 * execution cost, AI annotations) can render without re-processing the graph.
 */
export interface GraphOverlay {
  readonly nodeId: string;
  readonly kind: string;
  readonly payload?: unknown;
}

/**
 * Classify the edge from `previous` to `next`. Only depends on the two
 * snapshots (and their own fields), so it works both for adjacent snapshots
 * and for non-adjacent pairs that survive node filtering.
 */
export function deriveEdgeInfo(previous: Snapshot, next: Snapshot): GraphEdgeInfo {
  const nextIteration = next.iteration ?? 0;
  const nextDepth = next.callStack?.length ?? 0;
  const prevDepth = previous.callStack?.length ?? 0;

  // Loop back-edge: control jumped back to re-evaluate a loop condition.
  if (next.loopType !== undefined && next.condition !== undefined && nextIteration > 1) {
    return { kind: "loop", label: "loop" };
  }
  // Loop entry: first evaluation of a loop condition.
  if (next.loopType !== undefined && next.condition !== undefined && nextIteration === 1) {
    return { kind: "loop", label: "enter" };
  }
  // Branch: the previous snapshot decided the outcome; this is the taken edge.
  if (previous.condition !== undefined) {
    return { kind: "branch", label: previous.conditionResult ? "TRUE" : "FALSE" };
  }
  // Function call / return, from call-stack depth deltas.
  if (nextDepth > prevDepth) return { kind: "call", label: "call" };
  if (nextDepth < prevDepth) return { kind: "return", label: "return" };

  return { kind: "next" };
}

/**
 * Build the graph from immutable snapshots. One node per snapshot, one
 * directed edge per consecutive pair, plus a synthesized `error` node when
 * execution failed.
 */
export function buildExecutionGraph(
  snapshots: readonly Snapshot[],
  error?: ExecutionError | null,
): ExecutionGraph {
  const nodes: ExecutionGraphNode[] = snapshots.map((snapshot, i) => {
    const kind = classifySnapshot(snapshot, snapshots[i - 1]);
    return {
      id: nodeIdFor(i),
      snapshotIndex: i,
      step: i + 1,
      line: snapshot.line,
      description: snapshot.description,
      kind,
      condition: snapshot.condition,
      conditionResult: snapshot.conditionResult,
      loopType: snapshot.loopType,
      iteration: snapshot.iteration,
      overlays: [],
    };
  });

  const edges: ExecutionGraphEdge[] = [];
  for (let i = 0; i < snapshots.length - 1; i += 1) {
    edges.push(edgeBetween(snapshots[i], snapshots[i + 1], i, i + 1));
  }

  let hasError = false;
  if (error) {
    hasError = true;
    const errorIndex = snapshots.length;
    nodes.push({
      id: ERROR_NODE_ID,
      snapshotIndex: -1,
      step: errorIndex + 1,
      line: error.line ?? 0,
      description: error.message,
      kind: "error",
      overlays: [],
    });
    if (errorIndex > 0) {
      edges.push({
        id: `edge-${nodeIdFor(errorIndex - 1)}-${ERROR_NODE_ID}`,
        fromId: nodeIdFor(errorIndex - 1),
        toId: ERROR_NODE_ID,
        fromIndex: errorIndex - 1,
        toIndex: -1,
        kind: "next",
        label: "error",
        overlays: [],
      });
    }
  }

  return { nodes, edges, nodeCount: nodes.length, edgeCount: edges.length, hasError, snapshots };
}

function edgeBetween(
  previous: Snapshot,
  next: Snapshot,
  fromIndex: number,
  toIndex: number,
): ExecutionGraphEdge {
  const info = deriveEdgeInfo(previous, next);
  const fromId = nodeIdFor(fromIndex);
  const toId = nodeIdFor(toIndex);
  return {
    id: `edge-${fromId}-${toId}`,
    fromId,
    toId,
    fromIndex,
    toIndex,
    kind: info.kind,
    label: info.label,
    overlays: [],
  };
}

/**
 * Hide nodes of the given kinds and reconnect the surviving nodes. Edge
 * semantics are re-derived from the underlying snapshot pair, so a branch that
 * "skips over" a hidden node still reads TRUE/FALSE.
 */
export function filterExecutionGraph(
  graph: ExecutionGraph,
  hiddenKinds: ReadonlySet<ExecutionNodeKind>,
): ExecutionGraph {
  if (hiddenKinds.size === 0) return graph;

  const visible = graph.nodes.filter(
    (node) => node.kind === "error" || !hiddenKinds.has(node.kind),
  );

  const edges: ExecutionGraphEdge[] = [];
  for (let i = 0; i < visible.length - 1; i += 1) {
    const from = visible[i];
    const to = visible[i + 1];

    let info: GraphEdgeInfo = { kind: "next" };
    if (to.id === ERROR_NODE_ID) {
      info = { kind: "next", label: "error" };
    } else if (from.snapshotIndex >= 0 && to.snapshotIndex >= 0) {
      info = deriveEdgeInfo(graph.snapshots[from.snapshotIndex], graph.snapshots[to.snapshotIndex]);
    }

    edges.push({
      id: `edge-${from.id}-${to.id}`,
      fromId: from.id,
      toId: to.id,
      fromIndex: from.snapshotIndex,
      toIndex: to.snapshotIndex,
      kind: info.kind,
      label: info.label,
      overlays: [],
    });
  }

  return {
    nodes: visible,
    edges,
    nodeCount: visible.length,
    edgeCount: edges.length,
    hasError: graph.hasError,
    snapshots: graph.snapshots,
  };
}

/**
 * Selection sync helper: the ids of the nodes selected for a timeline index.
 * The graph never owns the current step — it derives it from `index`.
 */
export function graphSelection(
  graph: ExecutionGraph,
  currentIndex: number,
): ReadonlySet<string> {
  const selected = new Set<string>();
  if (currentIndex >= 0) selected.add(nodeIdFor(currentIndex));
  return selected;
}

/** True when the node lies on the executed path up to `currentIndex`. */
export function isGraphNodeOnPath(node: ExecutionGraphNode, currentIndex: number): boolean {
  return node.snapshotIndex >= 0 && node.snapshotIndex <= currentIndex;
}

/** True when the edge leads to a snapshot on the executed path. */
export function isGraphEdgeOnPath(edge: ExecutionGraphEdge, currentIndex: number): boolean {
  return edge.toIndex >= 0 && edge.toIndex <= currentIndex;
}

/**
 * Attach future overlays (breakpoints, watch, execution cost, AI annotations)
 * to matching nodes. Overlays for unknown ids are ignored; the graph structure
 * is otherwise untouched.
 */
export function overlayGraph(
  graph: ExecutionGraph,
  overlays: readonly GraphOverlay[],
): ExecutionGraph {
  if (overlays.length === 0) return graph;

  const nodes = graph.nodes.map((node) => {
    const mine = overlays.filter((overlay) => overlay.nodeId === node.id);
    if (mine.length === 0) return node;
    return { ...node, overlays: [...node.overlays, ...mine] };
  });

  return { ...graph, nodes };
}

/** Positioned node produced by the layout pass. */
export interface LayoutedGraphNode {
  readonly node: ExecutionGraphNode;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Result of {@link layoutExecutionGraph}: positions plus canvas bounds. */
export interface ExecutionGraphLayout {
  readonly nodes: readonly LayoutedGraphNode[];
  readonly width: number;
  readonly height: number;
}

/** dagre's DFS stack overflows around ~2000 chained nodes, so huge traces use a fast trace layout. */
const DAGRE_MAX_NODES = 1500;
/** Vertical/horizontal spacing between trace-layout ranks. */
const TRACE_RANK_STEP = GRAPH_NODE_HEIGHT + 56;

function layoutTrace(graph: ExecutionGraph, horizontal: boolean): ExecutionGraphLayout {
  const nodes: LayoutedGraphNode[] = graph.nodes.map((node) => ({
    node,
    x: horizontal ? node.snapshotIndex * TRACE_RANK_STEP : 0,
    y: horizontal ? 0 : node.snapshotIndex * TRACE_RANK_STEP,
    width: GRAPH_NODE_WIDTH,
    height: GRAPH_NODE_HEIGHT,
  }));
  const mainSize = (graph.nodeCount - 1) * TRACE_RANK_STEP + GRAPH_NODE_HEIGHT;
  return {
    nodes,
    width: horizontal ? mainSize : GRAPH_NODE_WIDTH,
    height: horizontal ? GRAPH_NODE_HEIGHT : mainSize,
  };
}

/**
 * Auto-layout with dagre: minimal edge crossings and readable spacing. Nodes
 * are placed at their top-left corner (dagre centers them). Deterministic for
 * the same graph.
 *
 * dagre is used for graphs up to {@link DAGRE_MAX_NODES} nodes. Beyond that its
 * acyclic DFS overflows the call stack on long linear chains, so very large
 * traces fall back to {@link layoutTrace}: a single O(V) column ordered by
 * snapshot index (exactly the shape of an execution trace), which also keeps
 * layout instant for the "5000+ nodes" target.
 */
export function layoutExecutionGraph(
  graph: ExecutionGraph,
  direction: "TB" | "LR" = "TB",
): ExecutionGraphLayout {
  if (graph.nodeCount === 0) return { nodes: [], width: 0, height: 0 };

  if (graph.nodeCount <= DAGRE_MAX_NODES) {
    return layoutDagre(graph, direction);
  }
  return layoutTrace(graph, direction === "LR");
}

function layoutDagre(graph: ExecutionGraph, direction: "TB" | "LR"): ExecutionGraphLayout {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 28, ranksep: 56, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: GRAPH_NODE_WIDTH, height: GRAPH_NODE_HEIGHT });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.fromId, edge.toId);
  }

  dagre.layout(g);
  const bounds = g.graph();

  const nodes: LayoutedGraphNode[] = graph.nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      node,
      x: pos.x - GRAPH_NODE_WIDTH / 2,
      y: pos.y - GRAPH_NODE_HEIGHT / 2,
      width: GRAPH_NODE_WIDTH,
      height: GRAPH_NODE_HEIGHT,
    };
  });

  return { nodes, width: bounds.width ?? 0, height: bounds.height ?? 0 };
}
