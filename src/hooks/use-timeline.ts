"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSearchIndex,
  classifyTimeline,
  computeDiff,
  playbackDelayMs,
  resolveKeyAction,
  searchTimeline,
  stepIndex,
  toggleSetItem,
} from "@/debugger";
import type { SnapshotDiff, SnapshotType, PlaybackSpeed } from "@/debugger";
import type { Snapshot } from "@/engine";

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
}

/**
 * Timeline state: playback, bookmarks, search, mini map, and all derived data
 * (snapshot types + diff against the previous snapshot).
 *
 * Playback never re-executes code — it only advances the selected snapshot
 * index. Everything else is derived with useMemo from the immutable snapshot
 * array, so large timelines stay cheap and navigation is instant.
 */
export function useTimeline(
  snapshots: readonly Snapshot[],
  index: number,
  onScrub: (target: number) => void,
): TimelineController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);
  const [bookmarks, setBookmarks] = useState<ReadonlySet<number>>(new Set());
  const [query, setQuery] = useState("");
  const [showMiniMap, setShowMiniMap] = useState(false);

  const length = snapshots.length;
  const lastIndex = length - 1;

  // Derived data, all snapshot-driven.
  const types = useMemo(() => classifyTimeline(snapshots), [snapshots]);
  const diff = useMemo(
    () => computeDiff(snapshots[index - 1], snapshots[index]),
    [snapshots, index],
  );
  const searchIndex = useMemo(() => buildSearchIndex(snapshots), [snapshots]);
  const matched = useMemo(() => searchTimeline(searchIndex, query), [searchIndex, query]);

  // "Actually playing" is derived: playback visibly stops once the cursor
  // reaches the last snapshot, even though the requested state stays true.
  const shouldPlay = isPlaying && length > 1 && index < lastIndex;

  // Playback: an interval that only advances the selected snapshot. The
  // interval is recreated per step so the cursor never lags the closure.
  useEffect(() => {
    if (!shouldPlay) return;
    const id = window.setInterval(() => {
      onScrub(Math.min(index + 1, lastIndex));
    }, playbackDelayMs(speed));
    return () => window.clearInterval(id);
  }, [shouldPlay, speed, index, length, lastIndex, onScrub]);

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

  // Keyboard: Home / End / Space / Shift+arrows / B. Owns nothing that the
  // visualizer already handles (plain arrows, Escape, R, Ctrl+Enter).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
  }, [index, length, lastIndex, onScrub, togglePlay, toggleBookmark]);

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
  };
}
