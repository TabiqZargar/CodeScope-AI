"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Terminal } from "lucide-react";
import type { ExecutionError } from "@/engine";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

interface ConsolePanelProps {
  lines: readonly string[];
  error: ExecutionError | null;
  /** True once the program has been run (to distinguish "no output" from "not run"). */
  hasRun: boolean;
}

export function ConsolePanel({ lines, error, hasRun }: ConsolePanelProps) {
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-medium text-zinc-200">Console</span>
        </div>
        {lines.length > 0 && (
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500 tabular-nums">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        )}
      </div>

      <div className="max-h-36 min-h-[72px] overflow-y-auto px-4 py-3">
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-500/[0.08] px-3 py-2.5"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-rose-300">{error.message}</p>
              <p className="mt-0.5 text-xs text-rose-400/70">
                {error.kind === "unsupported"
                  ? "Only a subset of JavaScript is supported."
                  : error.line != null
                    ? `Stopped at line ${error.line}.`
                    : "The program stopped before completing."}
              </p>
            </div>
          </motion.div>
        ) : lines.length === 0 ? (
          <p className="py-1 text-xs text-zinc-600">
            {hasRun
              ? "Program finished with no console output."
              : "Output will appear here after you press Run."}
          </p>
        ) : (
          <div className="flex flex-col gap-1 font-mono text-[13px]">
            <AnimatePresence initial={false}>
              {lines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn("flex items-baseline gap-2 leading-6")}
                >
                  <span className="select-none text-[10px] text-zinc-600 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="select-none text-sky-500/60">›</span>
                  <span className="break-all text-zinc-200">{line}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Panel>
  );
}
