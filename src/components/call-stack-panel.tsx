"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FunctionSquare, Layers } from "lucide-react";
import type { CallFrame } from "@/engine";
import { formatDisplayValue } from "@/engine";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

interface CallStackPanelProps {
  /** Active call frames, outermost first, innermost (current) last. */
  frames: readonly CallFrame[];
  /** Id of the frame highlighted as the current execution point. */
  currentFrame?: string;
  /** Number of frames pushed since the previous snapshot (accent them). */
  framesAdded?: number;
}

/**
 * Renders the active call stack, innermost (current) frame on top.
 * Pushes, pops and highlight changes are animated with Framer Motion only.
 */
export function CallStackPanel({ frames, currentFrame, framesAdded = 0 }: CallStackPanelProps) {
  // Innermost frame is the current one, so render it first.
  const stack = useMemo(() => [...frames].reverse(), [frames]);

  return (
    <Panel className="flex shrink-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Call Stack</span>
        </div>
        {stack.length > 0 && (
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500 tabular-nums">
            {stack.length} {stack.length === 1 ? "frame" : "frames"}
          </span>
        )}
      </div>

      <div className="max-h-60 min-h-0 flex-1 overflow-y-auto p-3">
        {stack.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-center">
            <FunctionSquare className="h-5 w-5 text-zinc-600" />
            <p className="text-xs font-medium text-zinc-500">No active calls</p>
            <p className="text-xs leading-5 text-zinc-600">
              Frames appear here as functions are entered and popped on return.
            </p>
          </div>
        ) : (
          <motion.ol layout className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {stack.map((frame, i) => {
                const isCurrent = frame.id === currentFrame;
                const isPushed = framesAdded > 0 && i < framesAdded;
                const locals = Object.entries(frame.variables);
                return (
                  <motion.li
                    layout
                    key={frame.id}
                    initial={{ opacity: 0, y: -16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className={cn(
                      "relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04]",
                      isPushed && !isCurrent && "border-amber-400/30",
                    )}
                  >
                    {isCurrent && (
                      <motion.span
                        layoutId="call-frame-active"
                        transition={{ type: "spring", stiffness: 380, damping: 34 }}
                        className="pointer-events-none absolute inset-0 rounded-xl border border-violet-400/40 bg-violet-500/[0.12]"
                      />
                    )}

                    <div className="relative flex items-center justify-between gap-2 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FunctionSquare
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            isCurrent ? "text-violet-300" : "text-zinc-500",
                          )}
                        />
                        <span className="truncate font-mono text-[13px] font-semibold text-zinc-100">
                          {frame.name}
                        </span>
                        <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 tabular-nums">
                          L{frame.line}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="rounded-md bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="relative flex flex-wrap items-center gap-1.5 px-3 pb-2">
                      {locals.length === 0 ? (
                        <span className="text-[10px] text-zinc-600">no locals</span>
                      ) : (
                        locals.map(([name, value]) => (
                          <span
                            key={name}
                            className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                          >
                            <span className="text-zinc-200">{name}</span>
                            <span className="text-zinc-500">=</span>{" "}
                            <span className="text-sky-300">{formatDisplayValue(value)}</span>
                          </span>
                        ))
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ol>
        )}
      </div>
    </Panel>
  );
}
