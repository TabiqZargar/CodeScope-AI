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
