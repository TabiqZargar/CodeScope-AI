"use client";

import { GitGraph, History } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DebuggerView = "timeline" | "graph";

interface ViewTabsProps {
  view: DebuggerView;
  onViewChange: (view: DebuggerView) => void;
  /** Step count shown on the Graph tab once a program has run. */
  count?: number;
}

interface TabProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count?: number;
  "data-tour-step"?: string;
}

function TabButton({ active, onClick, icon, label, count, ...rest }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      {...rest}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary/[0.15] text-ink-primary ring-1 ring-inset ring-primary/30"
          : "text-ink-muted hover:text-ink-secondary",
      )}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={cn("rounded px-1 py-px text-[9px] font-semibold tabular-nums", active ? "bg-primary/20 text-primary" : "bg-surface-hover text-ink-muted")}>
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Switches between the Timeline and Graph views. Both stay mounted (hidden,
 * not unmounted), so switching is instant and never reprocesses data.
 */
export function ViewTabs({ view, onViewChange, count = 0 }: ViewTabsProps) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-xl border border-line bg-surface-glass p-1">
      <TabButton
        active={view === "timeline"}
        onClick={() => onViewChange("timeline")}
        icon={<History className="h-3.5 w-3.5" />}
        label="Timeline"
      />
      <TabButton
        data-tour-step="5"
        active={view === "graph"}
        onClick={() => onViewChange("graph")}
        icon={<GitGraph className="h-3.5 w-3.5" />}
        label="Graph"
        count={count}
      />
    </div>
  );
}
