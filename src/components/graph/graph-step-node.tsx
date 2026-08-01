"use client";

import { memo } from "react";
import { AlertTriangle, Braces, Circle, GitBranch, LogIn, LogOut, PenLine, Repeat, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Node, NodeProps } from "@xyflow/react";
import type { ExecutionNodeKind } from "@/debugger";
import { cn } from "@/lib/utils";

/** Data carried by every graph node (computed once per layout). */
export type GraphStepNodeData = {
  readonly snapshotIndex: number;
  readonly step: number;
  readonly line: number;
  readonly description: string;
  readonly kind: ExecutionNodeKind;
  readonly conditionResult?: boolean;
  /** True when this node is the current debugger step. */
  readonly isCurrent: boolean;
  /** True when this node lies on the executed path up to the current step. */
  readonly isOnPath: boolean;
  /** True when the timeline search matches this step. */
  readonly isMatch: boolean;
  /** True when this node's line carries an enabled breakpoint. */
  readonly hasBreakpoint: boolean;
};

/** React Flow node type for graph steps. */
export type GraphStepNode = Node<GraphStepNodeData, "step">;

interface KindStyle {
  icon: LucideIcon;
  iconClass: string;
  borderClass: string;
  chipClass: string;
  label: string;
}

/** Distinct visual treatment per node kind (mirrors the timeline legend). */
export const GRAPH_KIND_STYLES: Record<ExecutionNodeKind, KindStyle> = {
  declaration: {
    icon: Braces,
    iconClass: "text-sky-300",
    borderClass: "border-sky-400/30",
    chipClass: "bg-sky-400/10 text-sky-300",
    label: "Declaration",
  },
  assignment: {
    icon: PenLine,
    iconClass: "text-amber-300",
    borderClass: "border-amber-400/30",
    chipClass: "bg-amber-400/10 text-amber-300",
    label: "Assignment",
  },
  condition: {
    icon: GitBranch,
    iconClass: "text-emerald-300",
    borderClass: "border-emerald-400/30",
    chipClass: "bg-emerald-400/10 text-emerald-300",
    label: "Condition",
  },
  loop: {
    icon: Repeat,
    iconClass: "text-violet-300",
    borderClass: "border-violet-400/30",
    chipClass: "bg-violet-400/10 text-violet-300",
    label: "Loop",
  },
  call: {
    icon: LogIn,
    iconClass: "text-cyan-300",
    borderClass: "border-cyan-400/30",
    chipClass: "bg-cyan-400/10 text-cyan-300",
    label: "Function Call",
  },
  return: {
    icon: LogOut,
    iconClass: "text-rose-300",
    borderClass: "border-rose-400/30",
    chipClass: "bg-rose-400/10 text-rose-300",
    label: "Return",
  },
  console: {
    icon: Terminal,
    iconClass: "text-fuchsia-300",
    borderClass: "border-fuchsia-400/30",
    chipClass: "bg-fuchsia-400/10 text-fuchsia-300",
    label: "Console",
  },
  other: {
    icon: Circle,
    iconClass: "text-zinc-500",
    borderClass: "border-white/[0.08]",
    chipClass: "bg-white/[0.06] text-zinc-400",
    label: "Step",
  },
  error: {
    icon: AlertTriangle,
    iconClass: "text-rose-400",
    borderClass: "border-rose-500/50",
    chipClass: "bg-rose-500/10 text-rose-400",
    label: "Error",
  },
};

/**
 * One graph node. Sized to GRAPH_NODE_WIDTH × GRAPH_NODE_HEIGHT (layout relies
 * on that). Purely presentational: selection, path and search states arrive
 * via `data`, so the component never owns debugger state.
 */
export const GraphStepNodeView = memo(function GraphStepNodeView({
  data,
  selected,
}: NodeProps<GraphStepNode>) {
  const style = GRAPH_KIND_STYLES[data.kind];
  const Icon = style.icon;

  return (
    <div
      title={data.description}
      className={cn(
        "flex h-[72px] w-[200px] cursor-pointer flex-col overflow-hidden rounded-xl border bg-zinc-900/90 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] transition-all duration-150",
        style.borderClass,
        data.isCurrent && "z-10 ring-2 ring-sky-400/80",
        !data.isCurrent && data.isOnPath && "hover:border-white/[0.2]",
        !data.isOnPath && "opacity-50",
        data.isMatch && !data.isCurrent && "ring-1 ring-amber-400/70",
        selected && "ring-2 ring-sky-400/60",
      )}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", style.iconClass)} />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {style.label}
        </span>
        {data.hasBreakpoint && (
          <span
            className="flex h-2 w-2 shrink-0 items-center justify-center rounded-full bg-rose-400 ring-2 ring-rose-400/25"
            title="Breakpoint"
          />
        )}
        <span className="shrink-0 rounded bg-white/[0.07] px-1 py-px font-mono text-[9px] text-zinc-300 tabular-nums">
          #{data.step}
        </span>
      </div>

      <p className="line-clamp-2 min-h-0 flex-1 px-2 text-[11px] font-medium leading-4 text-zinc-100">
        {data.description}
      </p>

      <div className="flex items-center gap-1.5 px-2 pb-1.5">
        <span className="rounded bg-white/[0.06] px-1 py-px font-mono text-[9px] text-zinc-500 tabular-nums">
          {data.line > 0 ? `L${data.line}` : "—"}
        </span>
        {data.conditionResult !== undefined && (
          <span
            className={cn(
              "rounded px-1 py-px text-[9px] font-bold tabular-nums",
              data.conditionResult
                ? "bg-emerald-400/10 text-emerald-300"
                : "bg-rose-400/10 text-rose-300",
            )}
          >
            {data.conditionResult ? "TRUE" : "FALSE"}
          </span>
        )}
        {data.kind === "error" && (
          <span className="truncate font-mono text-[9px] text-rose-400/80">
            execution failed
          </span>
        )}
      </div>
    </div>
  );
});
