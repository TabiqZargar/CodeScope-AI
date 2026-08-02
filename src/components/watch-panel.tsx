"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Plus, Trash2, TriangleAlert } from "lucide-react";
import { formatDisplayValue } from "@/engine";
import type { WatchController } from "@/hooks/use-watches";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface WatchPanelProps {
  controller: WatchController;
  hasRun: boolean;
  className?: string;
}

/**
 * Watch expressions panel. Values are evaluated against the currently selected
 * snapshot only — never the live runtime — so the panel is purely a view over
 * the immutable snapshots. Invalid expressions show their reason inline.
 */
export function WatchPanel({ controller, hasRun, className }: WatchPanelProps) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    controller.addWatch(draft);
    setDraft("");
  };

  return (
    <Panel className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-loops" />
          <span className="text-sm font-medium text-ink-secondary">Watch</span>
          {controller.watches.length > 0 && (
            <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-ink-muted tabular-nums">
              {controller.watches.length}
            </span>
          )}
        </div>
        {controller.watches.length > 0 && (
          <button
            type="button"
            onClick={controller.clearWatches}
            className="text-[10px] font-medium text-ink-muted transition-colors hover:text-ink-secondary"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {!hasRun ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-center">
            <Eye className="h-5 w-5 text-ink-disabled" />
            <p className="text-xs font-medium text-ink-muted">No execution to watch yet</p>
            <p className="text-xs leading-5 text-ink-disabled">
              Run your code, then add expressions like{" "}
              <code className="rounded bg-surface-hover px-1 py-0.5 text-loops">total</code>.
            </p>
          </div>
        ) : controller.watches.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-center">
            <Plus className="h-5 w-5 text-ink-disabled" />
            <p className="text-xs font-medium text-ink-muted">No watches yet</p>
            <p className="text-xs leading-5 text-ink-disabled">
              Add an expression below, e.g. <code className="rounded bg-surface-hover px-1 py-0.5 text-loops">items.length</code>.
            </p>
          </div>
        ) : (
          <motion.ul layout className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {controller.watches.map((watch, index) => {
                const result = controller.results[index];
                return (
                  <motion.li
                    layout
                    key={watch.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="group rounded-xl border border-line bg-surface-glass px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => controller.removeWatch(watch.id)}
                        title="Remove watch"
                        className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-md text-ink-disabled transition-colors hover:bg-danger/10 hover:text-danger group-hover:flex"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink-secondary">
                        {watch.expression}
                      </code>
                      {result?.ok ? (
                        <span
                          className="shrink-0 font-mono text-[13px] font-medium text-console tabular-nums"
                          title={result.value === undefined ? "undefined" : String(result.value)}
                        >
                          {formatDisplayValue(result.value)}
                        </span>
                      ) : (
                        <span
                          className="flex shrink-0 items-center gap-1 rounded-md bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger"
                          title={result?.reason}
                        >
                          <TriangleAlert className="h-3 w-3" />
                          {result?.reason ?? "—"}
                        </span>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}

        <div className="mt-3 flex shrink-0 items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
            }}
            placeholder="Add expression…"
            spellCheck={false}
            className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-glass px-2.5 font-mono text-xs text-ink-secondary placeholder:text-ink-disabled focus:border-loops/40 focus:outline-none"
          />
          <Button
            variant="secondary"
            size="icon"
            onClick={commit}
            disabled={!draft.trim()}
            aria-label="Add watch"
            title="Add watch expression"
            className="h-8 w-8 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Panel>
  );
}
