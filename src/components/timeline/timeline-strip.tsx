"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { SnapshotType } from "@/debugger";
import { TimelineNode } from "./timeline-node";

const ITEM_WIDTH = 52;
const OVERSCAN = 12;
const STRIP_HEIGHT = 56;

interface TimelineStripProps {
  total: number;
  lines: readonly number[];
  descriptions: readonly string[];
  types: readonly SnapshotType[];
  index: number;
  bookmarks: ReadonlySet<number>;
  matched: ReadonlySet<number>;
  /** Lines with an enabled breakpoint (shown as dots on matching nodes). */
  breakpointLines: ReadonlySet<number>;
  onSelect: (index: number) => void;
  onToggleBookmark: (index: number) => void;
}

/**
 * Virtualized timeline strip. Only the nodes inside the visible window (plus
 * an overscan margin) are mounted, so timelines with tens of thousands of
 * snapshots stay responsive. Scroll position and container width are tracked
 * locally; the strip auto-scrolls to keep the current node in view.
 */
export function TimelineStrip({
  total,
  lines,
  descriptions,
  types,
  index,
  bookmarks,
  matched,
  breakpointLines,
  onSelect,
  onToggleBookmark,
}: TimelineStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [width, setWidth] = useState(0);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  // Keep the current node visible (playback, keyboard navigation, jumps).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const itemLeft = index * ITEM_WIDTH;
    const itemRight = itemLeft + ITEM_WIDTH;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    if (itemLeft < viewLeft || itemRight > viewRight) {
      el.scrollLeft = Math.max(0, itemLeft - el.clientWidth / 2 + ITEM_WIDTH / 2);
    }
  }, [index, total]);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (el) setScrollLeft(el.scrollLeft);
  }, []);

  if (total <= 1) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-600">
        <span>Run your code to trace the timeline.</span>
      </div>
    );
  }

  const start = Math.max(0, Math.floor((scrollLeft - OVERSCAN * ITEM_WIDTH) / ITEM_WIDTH));
  const end = Math.min(
    total,
    Math.ceil((scrollLeft + width + OVERSCAN * ITEM_WIDTH) / ITEM_WIDTH),
  );
  const slice = [];

  for (let i = start; i < end; i += 1) {
    slice.push(
      <div key={i} className="absolute top-0 flex h-full" style={{ left: i * ITEM_WIDTH }}>
        <TimelineNode
          index={i}
          line={lines[i] ?? 0}
          type={types[i] ?? "other"}
          description={descriptions[i] ?? ""}
          isCurrent={i === index}
          isBookmarked={bookmarks.has(i)}
          isMatch={matched.has(i)}
          hasBreakpoint={breakpointLines.has(lines[i] ?? 0)}
          onSelect={onSelect}
          onToggleBookmark={onToggleBookmark}
        />
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="timeline-scroll h-full w-full overflow-x-auto overflow-y-hidden"
    >
      <div
        className="relative"
        style={{ width: total * ITEM_WIDTH, height: STRIP_HEIGHT }}
      >
        {slice}
      </div>
    </div>
  );
}
