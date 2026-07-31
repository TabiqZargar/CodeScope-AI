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
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search timeline…"
          spellCheck={false}
          className="h-8 w-40 rounded-lg border border-white/[0.08] bg-white/[0.04] pl-8 pr-7 text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-sky-400/50 focus:bg-white/[0.06]"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {query.length > 0 && (
        <span className="whitespace-nowrap text-[10px] tabular-nums">
          {matchedCount === 0 ? (
            <span className="text-zinc-600">no matches</span>
          ) : (
            <span className="text-amber-300">
              {matchedCount}/{total}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
