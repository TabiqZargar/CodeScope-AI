"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_BREAKPOINTS,
  buildBreakpointIndex,
  buildSearchIndex,
  classifyTimeline,
  clearBreakpoints as clearBreakpointsState,
  computeDiff,
  continueTarget,
  enabledBreakpointCount,
  enabledBreakpointLines,
  findNextBreakpointIndex,
  findPreviousBreakpointIndex,
  playbackDelayMs,
  removeBreakpoint as removeBreakpointState,
  resolveDebuggerKey,
  resolveKeyAction,
  searchTimeline,
  setBreakpointEnabled as setBreakpointEnabledState,
  shouldStopAtSnapshot,
  snapshotHitsBreakpoint,
  stepIndex,
  stepTarget,
  toggleBreakpoint as toggleBreakpointState,
  toggleSetItem,
} from "@/debugger";
import type { Breakpoint, BreakpointState, PlaybackSpeed, SnapshotDiff, SnapshotType } from "@/debugger";
import type { Snapshot } from "@/engine";

export interface TimelineOptions {
  /** Returns the line to toggle a breakpoint at (editor cursor), or null. */
  getBreakpointLine?: () => number | null;
  /** Watch expressions whose defined values participate in timeline search. */
  searchWatches?: readonly string[];
}

export interface TimelineController {
  isPlaying: boolean;
  togglePlay: () => void;
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;
  bookmarks: ReadonlySet<number>;
  toggleBookmark: (index: number) => void;
  isBookmarked: (index: number) => boolean;
  query: string;
  setQuery: (query: string) => void;
  matched: ReadonlySet<number>;
  matchedCount: number;
  showMiniMap: boolean;
  toggleMiniMap: () => void;
  types: readonly SnapshotType[];
  diff: SnapshotDiff;

  breakpoints: BreakpointState;
  /** Lines with an enabled breakpoint (O(1) lookup for UI badges). */
  breakpointLines: ReadonlySet<number>;
  breakpointCount: number;
  enabledBreakpointCount: number;
  toggleBreakpoint: (line: number) => void;
  setBreakpointEnabled: (line: number, enabled: boolean) => void;
  removeBreakpoint: (line: number) => void;
  clearBreakpoints: () => void;
  stoppedOnBreakpoint: boolean;

  continuePlayback: () => void;
  stopPlayback: () => void;
  jumpToNextBreakpoint: () => void;
  jumpToPreviousBreakpoint: () => void;

  /**
   * Bulk-restore playback state from a saved session. Only the listed slices
   * are touched; everything else (search query, diff, types) re-derives.
   */
  restore: (state: {
    breakpoints?: readonly { line: number; enabled: boolean }[];
    bookmarks?: ReadonlySet<number>;
    speed?: PlaybackSpeed;
    showMiniMap?: boolean;
  }) => void;
}

/**
 * Timeline state: playback, bookmarks, search, mini map, breakpoints, and all
 * derived data (snapshot types + diff against the previous snapshot).
 *
 * Playback never re-executes code — it only advances the selected snapshot
 * index. Breakpoints are React/UI state stored by line; playback stops
 * automatically (O(1) hit test) when the cursor lands on an enabled
 * breakpoint line, and Continue / Jump To Next-Previous Breakpoint locate
 * matching snapshots through a precomputed line index. Everything else is
 * derived with useMemo from the immutable snapshot array, so large timelines
 * stay cheap.
 */
export function useTimeline(
  snapshots: readonly Snapshot[],
  index: number,
  onScrub: (target: number) => void,
  options: TimelineOptions = {},
): TimelineController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);
  const [bookmarks, setBookmarks] = useState<ReadonlySet<number>>(new Set());
  const [query, setQuery] = useState("");
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [breakpoints, setBreakpoints] = useState<BreakpointState>(EMPTY_BREAKPOINTS);

  const getBreakpointLineRef = useRef(options.getBreakpointLine);
  useEffect(() => {
    getBreakpointLineRef.current = options.getBreakpointLine;
  });
  const searchWatches = options.searchWatches;

  const length = snapshots.length;
  const lastIndex = length - 1;

  // Derived data, all snapshot-driven.
  const types = useMemo(() => classifyTimeline(snapshots), [snapshots]);
  const diff = useMemo(
    () => computeDiff(snapshots[index - 1], snapshots[index]),
    [snapshots, index],
  );
  const lineIndex = useMemo(() => buildBreakpointIndex(snapshots), [snapshots]);
  const enabledLines = useMemo(() => enabledBreakpointLines(breakpoints), [breakpoints]);
  const searchIndex = useMemo(
    () =>
      buildSearchIndex(snapshots, {
        breakpointLines: enabledLines,
        watches: searchWatches,
      }),
    [snapshots, enabledLines, searchWatches],
  );
  const matched = useMemo(() => searchTimeline(searchIndex, query), [searchIndex, query]);

  // "Actually playing" is derived: playback visibly stops once the cursor
  // reaches the last snapshot, even though the requested state stays true.
  const shouldPlay = isPlaying && length > 1 && index < lastIndex;

  // Playback: an interval that only advances the selected snapshot. The
  // interval is recreated per step so the cursor never lags the closure. When
  // the next snapshot's line has an enabled breakpoint, playback lands on it
  // and stops automatically — the snapshot stays selected, nothing re-runs.
  useEffect(() => {
    if (!shouldPlay) return;
    const id = window.setInterval(() => {
      const next = continueTarget(index, length);
      onScrub(next);
      if (shouldStopAtSnapshot(snapshots[next], breakpoints)) {
        setIsPlaying(false);
      }
    }, playbackDelayMs(speed));
    return () => window.clearInterval(id);
  }, [shouldPlay, speed, index, length, lastIndex, onScrub, snapshots, breakpoints]);

  const togglePlay = useCallback(() => {
    if (length <= 1) {
      setIsPlaying(false);
      return;
    }
    if (shouldPlay) {
      setIsPlaying(false);
      return;
    }
    // Pressing play at the end restarts from the first snapshot.
    if (index >= lastIndex) onScrub(0);
    setIsPlaying(true);
  }, [shouldPlay, index, length, lastIndex, onScrub]);

  const continuePlayback = useCallback(() => {
    if (length <= 1) return;
    if (index >= lastIndex) onScrub(0);
    setIsPlaying(true);
  }, [length, index, lastIndex, onScrub]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const setSpeed = useCallback((next: PlaybackSpeed) => {
    setSpeedState(next);
  }, []);

  const toggleBookmark = useCallback((target: number) => {
    setBookmarks((prev) => toggleSetItem(prev, target));
  }, []);

  const isBookmarked = useCallback(
    (target: number) => bookmarks.has(target),
    [bookmarks],
  );

  const toggleMiniMap = useCallback(() => {
    setShowMiniMap((prev) => !prev);
  }, []);

  // Breakpoints: pure state transitions, keyed by line.
  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) => toggleBreakpointState(prev, line));
  }, []);

  const setBreakpointEnabled = useCallback((line: number, enabled: boolean) => {
    setBreakpoints((prev) => setBreakpointEnabledState(prev, line, enabled));
  }, []);

  const removeBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) => removeBreakpointState(prev, line));
  }, []);

  const clearBreakpoints = useCallback(() => {
    setBreakpoints(clearBreakpointsState());
  }, []);

  const jumpToNextBreakpoint = useCallback(() => {
    const target = findNextBreakpointIndex(index, breakpoints, lineIndex);
    if (target >= 0) onScrub(target);
  }, [index, breakpoints, lineIndex, onScrub]);

  const jumpToPreviousBreakpoint = useCallback(() => {
    const target = findPreviousBreakpointIndex(index, breakpoints, lineIndex);
    if (target >= 0) onScrub(target);
  }, [index, breakpoints, lineIndex, onScrub]);

  // Bulk restore for sessions: replace the named slices of playback state in
  // one call (React batches the setters), leaving derived state to re-derive.
  const restore = useCallback(
    (state: {
      breakpoints?: readonly { line: number; enabled: boolean }[];
      bookmarks?: ReadonlySet<number>;
      speed?: PlaybackSpeed;
      showMiniMap?: boolean;
    }): void => {
      if (state.breakpoints) {
        const next = new Map<number, Breakpoint>();
        for (const bp of state.breakpoints) {
          if (bp.line > 0) next.set(bp.line, { line: bp.line, enabled: bp.enabled });
        }
        setBreakpoints(next);
      }
      if (state.bookmarks) setBookmarks(new Set(state.bookmarks));
      if (state.speed !== undefined) setSpeedState(state.speed);
      if (typeof state.showMiniMap === "boolean") setShowMiniMap(state.showMiniMap);
    },
    [],
  );

  const currentSnapshot = index >= 0 ? snapshots[index] : undefined;
  const stoppedOnBreakpoint =
    !shouldPlay && currentSnapshot !== undefined && snapshotHitsBreakpoint(currentSnapshot, breakpoints);

  // Keyboard: F-keys always win (they never collide with typing), then the
  // timeline keys (Home / End / Space / Shift+arrows / B) which yield to the
  // editor and the visualizer's own arrow handling.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = resolveDebuggerKey(event.key, event.shiftKey);
      if (command.type !== "none") {
        event.preventDefault();
        switch (command.type) {
          case "continue":
            continuePlayback();
            break;
          case "stop":
            stopPlayback();
            break;
          case "step":
            onScrub(stepTarget(index, command.delta, length));
            break;
          case "toggle-breakpoint": {
            const line =
              getBreakpointLineRef.current?.() ?? snapshots[index]?.line ?? 0;
            if (line > 0) toggleBreakpoint(line);
            break;
          }
          case "jump-next-breakpoint":
            jumpToNextBreakpoint();
            break;
          case "jump-previous-breakpoint":
            jumpToPreviousBreakpoint();
            break;
          default:
            break;
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTyping =
        target != null &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.closest?.(".monaco-editor") != null);
      if (isTyping) return;
      if (length <= 1) return;

      const action = resolveKeyAction(event.key, event.shiftKey);
      if (action.type === "none") return;
      event.preventDefault();

      switch (action.type) {
        case "step":
          onScrub(stepIndex(index, action.delta, length));
          break;
        case "jump-first":
          onScrub(0);
          break;
        case "jump-last":
          onScrub(lastIndex);
          break;
        case "toggle-play":
          togglePlay();
          break;
        case "toggle-bookmark":
          toggleBookmark(index);
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    index,
    length,
    lastIndex,
    onScrub,
    togglePlay,
    toggleBookmark,
    toggleBreakpoint,
    continuePlayback,
    stopPlayback,
    jumpToNextBreakpoint,
    jumpToPreviousBreakpoint,
    snapshots,
  ]);

  return {
    isPlaying: shouldPlay,
    togglePlay,
    speed,
    setSpeed,
    bookmarks,
    toggleBookmark,
    isBookmarked,
    query,
    setQuery,
    matched,
    matchedCount: matched.size,
    showMiniMap,
    toggleMiniMap,
    types,
    diff,

    breakpoints,
    breakpointLines: enabledLines,
    breakpointCount: breakpoints.size,
    enabledBreakpointCount: enabledBreakpointCount(breakpoints),
    toggleBreakpoint,
    setBreakpointEnabled,
    removeBreakpoint,
    clearBreakpoints,
    stoppedOnBreakpoint,

    continuePlayback,
    stopPlayback,
    jumpToNextBreakpoint,
    jumpToPreviousBreakpoint,
    restore,
  };
}
