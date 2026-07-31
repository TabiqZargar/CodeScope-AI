"use client";

import { Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ControlsProps {
  hasRun: boolean;
  currentIndex: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onRun: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}

export function Controls({
  hasRun,
  currentIndex,
  total,
  canPrev,
  canNext,
  onRun,
  onPrev,
  onNext,
  onReset,
}: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Button onClick={onRun} className="pl-3.5 pr-4" size="lg">
          <Play className="h-4 w-4 fill-current" />
          Run
        </Button>

        <div className="mx-1 h-6 w-px bg-white/[0.08]" />

        <Button variant="secondary" onClick={onPrev} disabled={!canPrev} aria-label="Previous step">
          <SkipBack className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <Button variant="secondary" onClick={onNext} disabled={!canNext} aria-label="Next step">
          <span className="hidden sm:inline">Next</span>
          <SkipForward className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-white/[0.08]" />

        <Button variant="ghost" onClick={onReset} aria-label="Reset">
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>

      {hasRun ? (
        <span className="whitespace-nowrap text-xs font-medium text-zinc-400 tabular-nums">
          Step <span className="text-zinc-100">{currentIndex + 1}</span>
          <span className="text-zinc-600"> / {total}</span>
        </span>
      ) : (
        <span className="hidden text-xs text-zinc-600 sm:inline">
          Press <span className="text-zinc-400">⌘/Ctrl + Enter</span> to run
        </span>
      )}
    </div>
  );
}
