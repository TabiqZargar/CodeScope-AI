"use client";

import { useMemo } from "react";
import type { ExecutionNodeKind } from "@/debugger";
import { cn } from "@/lib/utils";
import { GRAPH_KIND_STYLES } from "./graph-step-node";

/** Kinds the user can toggle (error and other stay pinned). */
export const FILTERABLE_KINDS: readonly ExecutionNodeKind[] = [
  "console",
  "declaration",
  "assignment",
  "condition",
  "loop",
  "call",
  "return",
];

interface GraphFiltersProps {
  hiddenKinds: ReadonlySet<ExecutionNodeKind>;
  onToggle: (kind: ExecutionNodeKind) => void;
}

export function GraphFilters({ hiddenKinds, onToggle }: GraphFiltersProps) {
  const entries = useMemo(
    () => FILTERABLE_KINDS.map((kind) => [kind, GRAPH_KIND_STYLES[kind]] as const),
    [],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entries.map(([kind, style]) => {
        const Icon = style.icon;
        const hidden = hiddenKinds.has(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onToggle(kind)}
            aria-pressed={!hidden}
            title={`${hidden ? "Show" : "Hide"} ${style.label.toLowerCase()} nodes`}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors",
              hidden
                ? "border-line bg-bg-overlay text-ink-disabled opacity-50"
                : "border-line-strong bg-surface-hover text-ink-secondary hover:brightness-125",
            )}
          >
            <Icon className={cn("h-3 w-3", !hidden && style.iconClass)} />
            {style.label}
          </button>
        );
      })}
    </div>
  );
}
