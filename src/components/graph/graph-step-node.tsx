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
    iconClass: "text-primary",
    borderClass: "border-primary/30",
    chipClass: "bg-primary/10 text-primary",
    label: "Declaration",
  },
  assignment: {
    icon: PenLine,
    iconClass: "text-secondary",
    borderClass: "border-secondary/30",
    chipClass: "bg-secondary/10 text-secondary",
    label: "Assignment",
  },
  condition: {
    icon: GitBranch,
    iconClass: "text-conditions",
    borderClass: "border-conditions/30",
    chipClass: "bg-conditions/10 text-conditions",
    label: "Condition",
  },
  loop: {
    icon: Repeat,
    iconClass: "text-loops",
    borderClass: "border-loops/30",
    chipClass: "bg-loops/10 text-loops",
    label: "Loop",
  },
  call: {
    icon: LogIn,
    iconClass: "text-functions",
    borderClass: "border-functions/30",
    chipClass: "bg-functions/10 text-functions",
    label: "Function Call",
  },
  return: {
    icon: LogOut,
    iconClass: "text-heap",
    borderClass: "border-heap/30",
    chipClass: "bg-heap/10 text-heap",
    label: "Return",
  },
  console: {
    icon: Terminal,
    iconClass: "text-console",
    borderClass: "border-console/30",
    chipClass: "bg-console/10 text-console",
    label: "Console",
  },
  other: {
    icon: Circle,
    iconClass: "text-ink-disabled",
    borderClass: "border-line",
    chipClass: "bg-surface-hover text-ink-muted",
    label: "Step",
  },
  error: {
    icon: AlertTriangle,
    iconClass: "text-danger",
    borderClass: "border-danger/50",
    chipClass: "bg-danger/10 text-danger",
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
        "flex h-[72px] w-[200px] cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface-elevated shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] transition-all duration-150",
        style.borderClass,
        data.isCurrent && "z-10 ring-2 ring-primary/80 shadow-[0_0_24px_-4px_rgba(117,104,255,0.55)]",
        !data.isCurrent && data.isOnPath && "hover:border-line-strong",
        !data.isOnPath && "opacity-50",
        data.isMatch && !data.isCurrent && "ring-1 ring-loops/70",
        selected && "ring-2 ring-primary/60",
      )}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", style.iconClass)} />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          {style.label}
        </span>
        {data.hasBreakpoint && (
          <span
            className="flex h-2 w-2 shrink-0 items-center justify-center rounded-full bg-danger ring-2 ring-danger/25"
            title="Breakpoint"
          />
        )}
        <span className="shrink-0 rounded bg-surface-hover px-1 py-px font-mono text-[9px] text-ink-secondary tabular-nums">
          #{data.step}
        </span>
      </div>

      <p className="line-clamp-2 min-h-0 flex-1 px-2 text-[11px] font-medium leading-4 text-ink-primary">
        {data.description}
      </p>

      <div className="flex items-center gap-1.5 px-2 pb-1.5">
        <span className="rounded bg-surface-hover px-1 py-px font-mono text-[9px] text-ink-muted tabular-nums">
          {data.line > 0 ? `L${data.line}` : "—"}
        </span>
        {data.conditionResult !== undefined && (
          <span
            className={cn(
              "rounded px-1 py-px text-[9px] font-bold tabular-nums",
              data.conditionResult
                ? "bg-heap/10 text-heap"
                : "bg-danger/10 text-danger",
            )}
          >
            {data.conditionResult ? "TRUE" : "FALSE"}
          </span>
        )}
        {data.kind === "error" && (
          <span className="truncate font-mono text-[9px] text-danger/80">
            execution failed
          </span>
        )}
      </div>
    </div>
  );
});
