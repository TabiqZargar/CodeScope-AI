/**
 * Timeline navigation math and keyboard mapping.
 *
 * Everything here is pure: given an index, a length, a speed or a key event,
 * it returns the new index or the action to take. No React, no DOM, no
 * interpreter — fully unit-testable.
 */

/** Supported playback speeds, in order. */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Base interval for a snapshot at 1× playback, in milliseconds. */
export const PLAYBACK_BASE_MS = 1_000;

export function playbackDelayMs(speed: PlaybackSpeed): number {
  return PLAYBACK_BASE_MS / speed;
}

/** Clamp an index into a timeline of the given length (empty → 0). */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

/** Move by `delta` snapshots, clamped to the timeline. */
export function stepIndex(index: number, delta: number, length: number): number {
  return clampIndex(index + delta, length);
}

/** Jump to the first (0) or last (length - 1) snapshot. */
export function firstIndex(): number {
  return 0;
}

export function lastIndex(length: number): number {
  return length > 0 ? length - 1 : 0;
}

/** True when the timeline can step in the given direction. */
export function canStep(index: number, delta: number, length: number): boolean {
  return delta < 0 ? index > 0 : index < length - 1;
}

/** Insert or remove an item from a ReadonlySet, returning a new set. */
export function toggleSetItem<T>(set: ReadonlySet<T>, item: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  return next;
}

/**
 * Keyboard actions owned by the timeline. Plain ArrowLeft/ArrowRight are
 * intentionally excluded: the visualizer's own handler owns single-step
 * navigation, so this mapping never double-advances. Shift+arrows skip 10.
 */
export type TimelineKeyAction =
  | { readonly type: "step"; readonly delta: number }
  | { readonly type: "jump-first" }
  | { readonly type: "jump-last" }
  | { readonly type: "toggle-play" }
  | { readonly type: "toggle-bookmark" }
  | { readonly type: "none" };

export function resolveKeyAction(key: string, shiftKey: boolean): TimelineKeyAction {
  if (key === "ArrowLeft" && shiftKey) return { type: "step", delta: -10 };
  if (key === "ArrowRight" && shiftKey) return { type: "step", delta: 10 };
  if (key === "Home") return { type: "jump-first" };
  if (key === "End") return { type: "jump-last" };
  if (key === " ") return { type: "toggle-play" };
  if (key === "b" || key === "B") return { type: "toggle-bookmark" };
  return { type: "none" };
}

/** Apply a non-play action to produce the next index (unchanged for others). */
export function applyKeyAction(action: TimelineKeyAction, index: number, length: number): number {
  switch (action.type) {
    case "step":
      return stepIndex(index, action.delta, length);
    case "jump-first":
      return firstIndex();
    case "jump-last":
      return lastIndex(length);
    default:
      return index;
  }
}
