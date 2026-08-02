"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import {
  Braces,
  Circle,
  GitBranch,
  LogIn,
  LogOut,
  PenLine,
  Repeat,
  Star,
  Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SnapshotType } from "@/debugger";
import { cn } from "@/lib/utils";

/** Icon + color treatment per snapshot type (UI-only mapping). */
export const TYPE_META: Record<SnapshotType, { icon: LucideIcon; iconClass: string; dotClass: string }> = {
  declaration: { icon: Braces, iconClass: "text-primary", dotClass: "bg-primary" },
  assignment: { icon: PenLine, iconClass: "text-secondary", dotClass: "bg-secondary" },
  condition: { icon: GitBranch, iconClass: "text-conditions", dotClass: "bg-conditions" },
  loop: { icon: Repeat, iconClass: "text-loops", dotClass: "bg-loops" },
  call: { icon: LogIn, iconClass: "text-functions", dotClass: "bg-functions" },
  return: { icon: LogOut, iconClass: "text-heap", dotClass: "bg-heap" },
  console: { icon: Terminal, iconClass: "text-console", dotClass: "bg-console" },
  other: { icon: Circle, iconClass: "text-ink-disabled", dotClass: "bg-ink-disabled" },
};

export interface TimelineNodeProps {
  index: number;
  line: number;
  type: SnapshotType;
  description: string;
  isCurrent: boolean;
  isBookmarked: boolean;
  isMatch: boolean;
  hasBreakpoint: boolean;
  onSelect: (index: number) => void;
  onToggleBookmark: (index: number) => void;
}

/**
 * One snapshot on the timeline. Memoized so only nodes inside the virtualized
 * window render, and only the current/bookmarked/matched ones re-render on
 * state changes. Shows type icon, step number and executed line.
 */
export const TimelineNode = memo(function TimelineNode({
  index,
  line,
  type,
  description,
  isCurrent,
  isBookmarked,
  isMatch,
  hasBreakpoint,
  onSelect,
  onToggleBookmark,
}: TimelineNodeProps) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  return (
    <motion.button
      layout
      type="button"
      onClick={() => onSelect(index)}
      title={`Step ${index + 1} · Line ${line || "—"} · ${description}${hasBreakpoint ? " · Breakpoint" : ""}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className={cn(
        "group relative flex h-full w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors duration-150",
        isCurrent
          ? "border-line-active bg-primary/[0.12]"
          : "border-line bg-surface-glass hover:border-line-strong hover:bg-surface-hover",
        isMatch && !isCurrent && "border-loops/40",
      )}
    >
      {isCurrent && (
        <motion.span
          layoutId="timeline-current"
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-primary/60"
        />
      )}

      {hasBreakpoint && (
        <span className="absolute -left-0.5 top-0.5" title="Breakpoint line">
          <span className="block h-1.5 w-1.5 rounded-full bg-danger ring-2 ring-danger/20" />
        </span>
      )}

      {isBookmarked && (
        <span className="absolute right-0.5 top-0.5">
          <Star className="h-2.5 w-2.5 fill-loops text-loops" />
        </span>
      )}

      <Icon className={cn("h-3.5 w-3.5", meta.iconClass)} />
      <span className="text-[10px] font-medium leading-none text-ink-secondary tabular-nums">
        {index + 1}
      </span>
      <span className="text-[9px] leading-none text-ink-disabled tabular-nums">
        {line > 0 ? `L${line}` : "—"}
      </span>

      {isCurrent && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleBookmark(index);
          }}
          title={isBookmarked ? "Remove bookmark" : "Bookmark this step"}
          className="absolute -bottom-1.5 -right-1.5 hidden h-4 w-4 items-center justify-center rounded-full border border-line-strong bg-canvas-elevated text-ink-muted hover:text-loops group-hover:flex"
        >
          <Star
            className={cn(
              "h-2.5 w-2.5",
              isBookmarked ? "fill-loops text-loops" : "text-ink-muted",
            )}
          />
        </button>
      )}
    </motion.button>
  );
});
