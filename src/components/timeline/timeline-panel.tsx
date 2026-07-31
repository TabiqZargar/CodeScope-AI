"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { History, Map, Pause, Play, Star } from "lucide-react";
import type { TimelineController } from "@/hooks/use-timeline";
import type { Snapshot } from "@/engine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { TimelineSearch } from "./timeline-search";
import { SpeedSelector } from "./speed-selector";
import { TimelineStrip } from "./timeline-strip";
import { TimelineMiniMap } from "./timeline-mini-map";

interface TimelinePanelProps {
  snapshots: readonly Snapshot[];
  index: number;
  timeline: TimelineController;
  /** Jump to a snapshot index (never re-executes — just re-selects). */
  onSelect: (index: number) => void;
}

/**
 * The interactive debugger timeline. Entirely snapshot-driven: every node is
 * one immutable snapshot, scrubbing just points at an existing one, and
 * playback only advances the selected index (no re-execution).
 */
export function TimelinePanel({ snapshots, index, timeline, onSelect }: TimelinePanelProps) {
  const lines = useMemo(() => snapshots.map((snapshot) => snapshot.line), [snapshots]);
  const descriptions = useMemo(
    () => snapshots.map((snapshot) => snapshot.description),
    [snapshots],
  );
  const total = snapshots.length;
  const hasRun = total > 0;

  return (
    <Panel className="flex shrink-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-medium text-zinc-200">Timeline</span>
          {hasRun ? (
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500 tabular-nums">
              {total} {total === 1 ? "step" : "steps"}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TimelineSearch
            query={timeline.query}
            onQueryChange={timeline.setQuery}
            matchedCount={timeline.matchedCount}
            total={total}
          />

          {timeline.bookmarks.size > 0 && (
            <span className="hidden items-center gap-1 rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 sm:flex">
              <Star className="h-3 w-3 fill-current" />
              {timeline.bookmarks.size}
            </span>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={timeline.toggleMiniMap}
            disabled={!hasRun}
            aria-label="Toggle mini map"
            title="Toggle mini map"
            className={cn(timeline.showMiniMap && "bg-white/[0.1] text-sky-300")}
          >
            <Map className="h-3.5 w-3.5" />
          </Button>

          <SpeedSelector speed={timeline.speed} onSpeedChange={timeline.setSpeed} />

          <Button
            variant={timeline.isPlaying ? "secondary" : "default"}
            size="sm"
            onClick={timeline.togglePlay}
            disabled={!hasRun}
            aria-label={timeline.isPlaying ? "Pause playback" : "Play snapshots"}
            title={timeline.isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {timeline.isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 pb-2.5">
        <div className="flex items-center gap-3">
          {hasRun && (
            <span className="shrink-0 text-xs font-medium text-zinc-400 tabular-nums">
              Step{" "}
              <motion.span
                key={index}
                initial={{ opacity: 0.4, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-block text-zinc-100"
              >
                {index + 1}
              </motion.span>
              <span className="text-zinc-600"> / {total}</span>
            </span>
          )}
          <div className="h-7 min-w-0 flex-1">
            <TimelineStrip
              total={total}
              lines={lines}
              descriptions={descriptions}
              types={timeline.types}
              index={index}
              bookmarks={timeline.bookmarks}
              matched={timeline.matched}
              onSelect={onSelect}
              onToggleBookmark={timeline.toggleBookmark}
            />
          </div>
        </div>

        {timeline.showMiniMap && hasRun && (
          <TimelineMiniMap
            total={total}
            lines={lines}
            descriptions={descriptions}
            types={timeline.types}
            index={index}
            bookmarks={timeline.bookmarks}
            matched={timeline.matched}
            onSelect={onSelect}
          />
        )}
      </div>
    </Panel>
  );
}
