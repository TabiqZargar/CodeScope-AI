"use client";

import { PLAYBACK_SPEEDS } from "@/debugger";
import type { PlaybackSpeed } from "@/debugger";
import { cn } from "@/lib/utils";

interface SpeedSelectorProps {
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

const formatSpeed = (speed: number): string => (speed === 1 ? "1x" : `${speed}x`);

export function SpeedSelector({ speed, onSpeedChange }: SpeedSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.04] p-0.5">
      {PLAYBACK_SPEEDS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSpeedChange(option)}
          title={`Playback speed ${formatSpeed(option)}`}
          className={cn(
            "rounded-md px-1.5 py-1 text-[10px] font-medium tabular-nums transition-colors",
            speed === option
              ? "bg-sky-500/20 text-sky-300"
              : "text-zinc-500 hover:text-zinc-200",
          )}
        >
          {formatSpeed(option)}
        </button>
      ))}
    </div>
  );
}
