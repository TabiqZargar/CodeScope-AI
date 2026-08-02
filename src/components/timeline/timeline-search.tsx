"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  matchedCount: number;
  total: number;
  className?: string;
}

export function TimelineSearch({
  query,
  onQueryChange,
  matchedCount,
  total,
  className,
}: TimelineSearchProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search timeline…"
          spellCheck={false}
          className="h-8 w-40 rounded-lg border border-line-strong bg-surface-glass pl-8 pr-7 text-xs text-ink-secondary outline-none transition-colors placeholder:text-ink-disabled focus:border-primary/50 focus:bg-surface-hover"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:text-ink-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {query.length > 0 && (
        <span className="whitespace-nowrap text-[10px] tabular-nums">
          {matchedCount === 0 ? (
            <span className="text-ink-disabled">no matches</span>
          ) : (
            <span className="text-loops">
              {matchedCount}/{total}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
