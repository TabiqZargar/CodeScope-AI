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
  declaration: { icon: Braces, iconClass: "text-sky-300", dotClass: "bg-sky-400" },
  assignment: { icon: PenLine, iconClass: "text-amber-300", dotClass: "bg-amber-400" },
  condition: { icon: GitBranch, iconClass: "text-emerald-300", dotClass: "bg-emerald-400" },
  loop: { icon: Repeat, iconClass: "text-violet-300", dotClass: "bg-violet-400" },
  call: { icon: LogIn, iconClass: "text-cyan-300", dotClass: "bg-cyan-400" },
  return: { icon: LogOut, iconClass: "text-rose-300", dotClass: "bg-rose-400" },
  console: { icon: Terminal, iconClass: "text-fuchsia-300", dotClass: "bg-fuchsia-400" },
  other: { icon: Circle, iconClass: "text-zinc-500", dotClass: "bg-zinc-500" },
};

export interface TimelineNodeProps {
  index: number;
  line: number;
  type: SnapshotType;
  description: string;
  isCurrent: boolean;
  isBookmarked: boolean;
  isMatch: boolean;
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
      title={`Step ${index + 1} · Line ${line || "—"} · ${description}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className={cn(
        "group relative flex h-full w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors duration-150",
        isCurrent
          ? "border-sky-400/50 bg-sky-500/[0.12]"
          : "border-white/[0.05] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.06]",
        isMatch && !isCurrent && "border-amber-400/40",
      )}
    >
      {isCurrent && (
        <motion.span
          layoutId="timeline-current"
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-sky-400/60"
        />
      )}

      {isBookmarked && (
        <span className="absolute right-0.5 top-0.5">
          <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
        </span>
      )}

      <Icon className={cn("h-3.5 w-3.5", meta.iconClass)} />
      <span className="text-[10px] font-medium leading-none text-zinc-300 tabular-nums">
        {index + 1}
      </span>
      <span className="text-[9px] leading-none text-zinc-600 tabular-nums">
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
          className="absolute -bottom-1.5 -right-1.5 hidden h-4 w-4 items-center justify-center rounded-full border border-white/[0.12] bg-zinc-900 text-zinc-400 hover:text-amber-300 group-hover:flex"
        >
          <Star
            className={cn(
              "h-2.5 w-2.5",
              isBookmarked ? "fill-amber-300 text-amber-300" : "text-zinc-400",
            )}
          />
        </button>
      )}
    </motion.button>
  );
});
