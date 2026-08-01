/**
 * Debugger layer — pure, React-free timeline intelligence.
 *
 * Kept strictly separate from the execution engine. Everything here derives
 * from immutable snapshots (never interpreter state) and powers the timeline
 * UI: snapshot classification, diffing, search, navigation and playback math.
 *
 * Future debugger features (breakpoints, watch expressions, execution graph,
 * AI explanations) plug in here without touching the engine.
 */
export { SNAPSHOT_CLASSIFIERS, classifySnapshot, classifyTimeline } from "./snapshot-type";
export type { SnapshotClassifier, SnapshotType } from "./snapshot-type";
export { computeDiff } from "./diff";
export type { SnapshotDiff, VariableChange } from "./diff";
export { buildSearchIndex, countMatches, searchTimeline, snapshotSearchText } from "./search";
export type { SearchExtras } from "./search";
export {
  PLAYBACK_BASE_MS,
  PLAYBACK_SPEEDS,
  applyKeyAction,
  canStep,
  clampIndex,
  firstIndex,
  lastIndex,
  playbackDelayMs,
  resolveKeyAction,
  stepIndex,
  toggleSetItem,
} from "./navigation";
export type { PlaybackSpeed, TimelineKeyAction } from "./navigation";
export {
  EMPTY_BREAKPOINTS,
  breakpointAtLine,
  breakpointCount,
  buildBreakpointIndex,
  clearBreakpoints,
  enabledBreakpointCount,
  enabledBreakpointLines,
  hasEnabledBreakpoint,
  removeBreakpoint,
  setBreakpointEnabled,
  snapshotHitsBreakpoint,
  toggleBreakpoint,
} from "./breakpoints";
export type { Breakpoint, BreakpointState } from "./breakpoints";
export {
  continueTarget,
  findNextBreakpointIndex,
  findPreviousBreakpointIndex,
  resolveDebuggerKey,
  shouldStopAtSnapshot,
  stepTarget,
} from "./commands";
export type { DebuggerCommand } from "./commands";
export {
  evaluateWatchExpression,
  evaluateWatches,
  parseWatchExpression,
  watchHasValue,
} from "./watch";
export type { WatchEvalResult } from "./watch";
export { inspectSnapshot } from "./inspector";
export type { SnapshotInspection } from "./inspector";
export {
  ERROR_NODE_ID,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  buildExecutionGraph,
  deriveEdgeInfo,
  filterExecutionGraph,
  graphSelection,
  isGraphEdgeOnPath,
  isGraphNodeOnPath,
  layoutExecutionGraph,
  nodeIdFor,
  overlayGraph,
} from "./graph";
export type {
  ExecutionGraph,
  ExecutionGraphEdge,
  ExecutionGraphLayout,
  ExecutionGraphNode,
  ExecutionNodeKind,
  GraphEdgeInfo,
  GraphEdgeKind,
  GraphOverlay,
  LayoutedGraphNode,
} from "./graph";
