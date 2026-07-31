"use client";

import { useMemo } from "react";
import type { SnapshotType } from "@/debugger";
import { cn } from "@/lib/utils";
import { TYPE_META } from "./timeline-node";

/** Cap on rendered dots; larger timelines are sampled to fit. */
const MAX_DOTS = 240;

interface TimelineMiniMapProps {
  total: number;
  lines: readonly number[];
  descriptions: readonly string[];
  types: readonly SnapshotType[];
  index: number;
  bookmarks: ReadonlySet<number>;
  matched: ReadonlySet<number>;
  onSelect: (index: number) => void;
}

/**
 * Compact overview of the whole timeline: one colored dot per snapshot (or a
 * representative sample for very long runs). Hover reveals step, line and
 * description; click jumps instantly. Bookmarks and search matches are marked.
 */
export function TimelineMiniMap({
  total,
  lines,
  descriptions,
  types,
  index,
  bookmarks,
  matched,
  onSelect,
}: TimelineMiniMapProps) {
  const dots = useMemo(() => {
    if (total <= 0) return [];
    const stride = Math.max(1, Math.ceil(total / MAX_DOTS));
    const result: number[] = [];
    for (let i = 0; i < total; i += stride) result.push(i);
    return result;
  }, [total]);

  if (total <= 1) return null;

  return (
    <div className="relative h-7 w-full select-none" aria-label="Timeline overview">
      <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/[0.06]" />
      {dots.map((i) => {
        const meta = TYPE_META[types[i] ?? "other"];
        const isCurrent = i === index;
        const isBookmarked = bookmarks.has(i);
        const isMatch = matched.has(i);
        const left = total > 1 ? (i / (total - 1)) * 100 : 0;
        return (
          <button
            key={i}
            type="button"
            title={`Step ${i + 1} · Line ${lines[i] ?? "—"} · ${descriptions[i] ?? ""}`}
            onClick={() => onSelect(i)}
            className={cn(
              "absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-100",
              meta.dotClass,
              isCurrent && "z-10 h-3 w-3 ring-2 ring-white/80",
              isBookmarked && "outline outline-1 outline-offset-1 outline-amber-300",
              isMatch && "brightness-150",
              !isCurrent && "hover:scale-150",
            )}
            style={{ left: `${left}%` }}
            aria-label={`Step ${i + 1}`}
          />
        );
      })}
    </div>
  );
}
