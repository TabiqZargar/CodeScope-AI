"use client";

import { motion } from "framer-motion";
import { BookOpen, CodeXml, Share2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type EngineStatus = "idle" | "completed" | "error";

const STATUS_META: Record<EngineStatus, { label: string; dot: string; text: string }> = {
  idle: { label: "Ready", dot: "bg-ink-muted", text: "text-ink-secondary" },
  completed: { label: "Completed", dot: "bg-heap", text: "text-heap" },
  error: { label: "Error", dot: "bg-danger", text: "text-danger" },
};

interface HeaderProps {
  status: EngineStatus;
  /** Number of executed statements when the run completed. */
  stepCount?: number;
  /** When provided, shows the share / session button. */
  onOpenSession?: () => void;
  /** When provided, shows the example gallery button. */
  onOpenExamples?: () => void;
}

export function Header({ status, stepCount, onOpenSession, onOpenExamples }: HeaderProps) {
  const meta = STATUS_META[status];

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3 bg-bg-elevated/80 backdrop-blur-[18px] border-b border-line shadow-panel w-full">
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-[0_8px_24px_-8px_rgba(117,104,255,0.7)]"
        >
          <CodeXml className="h-5 w-5 text-black" strokeWidth={2.4} />
        </motion.div>
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              CodeScope AI
            </span>
          </div>
          <span className="mt-1 text-[11px] text-ink-muted">
            Step-by-step JavaScript visualizer
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {status === "completed" && (
          <span className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
            <Zap className="h-3.5 w-3.5 text-secondary" />
            {stepCount} steps traced
          </span>
        )}
        {onOpenExamples && (
          <button
            type="button"
            data-tour-step="1"
            onClick={onOpenExamples}
            aria-label="Browse example programs"
            className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface-hover px-3.5 text-xs font-medium text-ink-secondary transition-colors hover:brightness-125 hover:text-ink-primary magnetic-btn"
          >
            <BookOpen className="h-3.5 w-3.5 text-secondary" />
            Examples
          </button>
        )}
        {onOpenSession && (
          <button
            type="button"
            onClick={onOpenSession}
            aria-label="Share or manage this session"
            className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface-hover px-3.5 text-xs font-medium text-ink-secondary transition-colors hover:brightness-125 hover:text-ink-primary magnetic-btn"
          >
            <Share2 className="h-3.5 w-3.5 text-secondary" />
            Share
          </button>
        )}
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border border-line-strong bg-surface-hover px-3.5 py-1.5 text-xs font-medium backdrop-blur",
            meta.text,
          )}
        >
          <span className={cn("relative flex h-1.5 w-1.5")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          </span>
          {meta.label}
        </div>
      </div>
    </header>
  );
}
