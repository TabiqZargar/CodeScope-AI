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

  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-xl border border-white/[0.1] bg-zinc-900/95 p-3 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      style={{ left: x + 14, top: y + 14 }}
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
        <span className="text-[10px] font-medium text-zinc-400 tabular-nums">
          Step {node.step} · {node.line > 0 ? `Line ${node.line}` : "line —"}
        </span>
      </div>

      <p className="mt-1.5 text-[12px] font-medium leading-5 text-zinc-100">
        {node.description}
      </p>

      {variables && (
        <div className="mt-2 flex flex-col gap-1 border-t border-white/[0.06] pt-2">
          {variables.entries.length === 0 ? (
            <span className="text-[10px] text-zinc-600">no variables at this step</span>
          ) : (
            variables.entries.map(([name, value]) => (
              <div key={name} className="flex items-baseline justify-between gap-3">
                <span className="truncate font-mono text-[10px] text-zinc-300">{name}</span>
                <span className="truncate font-mono text-[10px] text-sky-300 tabular-nums">
                  {formatDisplayValue(value)}
                </span>
              </div>
            ))
          )}
          {variables.total > variables.entries.length && (
            <span className="text-[9px] text-zinc-600">
              +{variables.total - variables.entries.length} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
