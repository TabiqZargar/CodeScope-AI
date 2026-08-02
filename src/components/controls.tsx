"use client";

import { ChevronDown, ChevronUp, Play, RotateCcw, SkipBack, SkipForward, Square } from "lucide-react";
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
  /** Continue playback until the next breakpoint (or the end). */
  onContinue: () => void;
  /** Stop playback (freeze the current step). */
  onStop: () => void;
  /** Jump to the next snapshot with an enabled breakpoint line. */
  onNextBreakpoint: () => void;
  /** Jump to the previous snapshot with an enabled breakpoint line. */
  onPreviousBreakpoint: () => void;
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
  onContinue,
  onStop,
  onNextBreakpoint,
  onPreviousBreakpoint,
}: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-glass px-3 py-2.5 backdrop-blur-[18px] shadow-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button data-tour-step="2" onClick={onRun} className="pl-3.5 pr-4" size="lg">
          <Play className="h-4 w-4 fill-current" />
          Run
        </Button>

        <div className="mx-1 h-6 w-px bg-surface-hover" />

        <Button variant="secondary" onClick={onPrev} disabled={!canPrev} aria-label="Previous step">
          <SkipBack className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <Button variant="secondary" data-tour-step="3" onClick={onNext} disabled={!canNext} aria-label="Next step">
          <span className="hidden sm:inline">Next</span>
          <SkipForward className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-surface-hover" />

        <Button
          variant="secondary"
          onClick={onPreviousBreakpoint}
          disabled={!hasRun}
          aria-label="Previous breakpoint"
          title="Jump to previous breakpoint (Shift+F10)"
        >
          <ChevronUp className="h-4 w-4" />
          <span className="hidden lg:inline">Prev BP</span>
        </Button>
        <Button
          variant="secondary"
          onClick={onNextBreakpoint}
          disabled={!hasRun}
          aria-label="Next breakpoint"
          title="Jump to next breakpoint (F10)"
        >
          <span className="hidden lg:inline">Next BP</span>
          <ChevronDown className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-surface-hover" />

        <Button
          variant="secondary"
          onClick={onContinue}
          disabled={!hasRun}
          aria-label="Continue to next breakpoint"
          title="Continue to next breakpoint (F5)"
        >
          <Play className="h-4 w-4" />
          <span className="hidden sm:inline">Continue</span>
        </Button>
        <Button
          variant="ghost"
          onClick={onStop}
          disabled={!hasRun}
          aria-label="Stop playback"
          title="Stop playback (Shift+F5)"
        >
          <Square className="h-4 w-4" />
          <span className="hidden sm:inline">Stop</span>
        </Button>

        <div className="mx-1 h-6 w-px bg-surface-hover" />

        <Button variant="ghost" onClick={onReset} aria-label="Reset">
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>

      {hasRun ? (
        <span className="whitespace-nowrap text-xs font-medium text-ink-muted tabular-nums">
          Step <span className="text-ink-primary">{currentIndex + 1}</span>
          <span className="text-ink-disabled"> / {total}</span>
        </span>
      ) : (
        <span className="hidden text-xs text-ink-disabled sm:inline">
          Press <span className="text-ink-secondary">⌘/Ctrl + Enter</span> to run
        </span>
      )}
    </div>
  );
}
