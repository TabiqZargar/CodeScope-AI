"use client";

import { useMemo } from "react";
import type { ExecutionGraphNode } from "@/debugger";
import type { Snapshot } from "@/engine";
import { formatDisplayValue } from "@/engine";
import { cn } from "@/lib/utils";
import { GRAPH_KIND_STYLES } from "./graph-step-node";

interface GraphHoverCardProps {
  node: ExecutionGraphNode;
  snapshots: readonly Snapshot[];
  x: number;
  y: number;
}

/**
 * Floating preview shown while hovering a graph node: step, line, full
 * description and the variables captured at that snapshot.
 */
export function GraphHoverCard({ node, snapshots, x, y }: GraphHoverCardProps) {
  const style = GRAPH_KIND_STYLES[node.kind];

  const variables = useMemo(() => {
    const snapshot = snapshots[node.snapshotIndex];
    if (!snapshot) return null;
    const entries = Object.entries(snapshot.variables);
    return {
      entries: entries.slice(0, 8),
      total: entries.length,
    };
  }, [node.snapshotIndex, snapshots]);

  // Keep the 288px (w-72) card on screen even on narrow viewports.
  const offset = 14;
  const left =
    typeof window === "undefined"
      ? x + offset
      : Math.max(12, Math.min(x + offset, window.innerWidth - 288 - 12));

  return (
    <div
      className="pointer-events-none fixed z-50 w-72 max-w-[calc(100vw-24px)] rounded-xl border border-line-strong bg-bg-elevated/95 p-3 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.9)] backdrop-blur-[18px]"
      style={{ left, top: y + offset }}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            style.chipClass,
          )}
        >
          {style.label}
        </span>
        <span className="text-[10px] font-medium text-ink-muted tabular-nums">
          Step {node.step} · {node.line > 0 ? `Line ${node.line}` : "line —"}
        </span>
      </div>

      <p className="mt-1.5 text-[12px] font-medium leading-5 text-ink-primary">
        {node.description}
      </p>

      {variables && (
        <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
          {variables.entries.length === 0 ? (
            <span className="text-[10px] text-ink-disabled">no variables at this step</span>
          ) : (
            variables.entries.map(([name, value]) => (
              <div key={name} className="flex items-baseline justify-between gap-3">
                <span className="truncate font-mono text-[10px] text-ink-secondary">{name}</span>
                <span className="truncate font-mono text-[10px] text-console tabular-nums">
                  {formatDisplayValue(value)}
                </span>
              </div>
            ))
          )}
          {variables.total > variables.entries.length && (
            <span className="text-[9px] text-ink-disabled">
              +{variables.total - variables.entries.length} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
