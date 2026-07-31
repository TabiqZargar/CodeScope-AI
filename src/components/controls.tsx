"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
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
  onScrub: (index: number) => void;
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
  onScrub,
}: ControlsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const progress = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el || total < 2) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    onScrub(Math.round(fraction * (total - 1)));
  };

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

      <div className="flex min-w-0 items-center gap-3">
        {hasRun ? (
          <>
            <span className="whitespace-nowrap text-xs font-medium text-zinc-400 tabular-nums">
              Step <span className="text-zinc-100">{currentIndex + 1}</span>
              <span className="text-zinc-600"> / {total}</span>
            </span>
            <div
              ref={trackRef}
              onClick={handleScrub}
              className="hidden h-1.5 w-28 cursor-pointer rounded-full bg-white/[0.08] sm:block"
              role="slider"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={currentIndex + 1}
              aria-label="Execution timeline"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
              />
            </div>
          </>
        ) : (
          <span className="hidden text-xs text-zinc-600 sm:inline">
            Press <span className="text-zinc-400">⌘/Ctrl + Enter</span> to run
          </span>
        )}
      </div>
    </div>
  );
}
