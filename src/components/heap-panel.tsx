"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Braces, List } from "lucide-react";
import type { HeapNode } from "@/engine";
import { formatDisplayValue } from "@/engine";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

interface HeapPanelProps {
  /** Snapshot of the heap: every allocated object and array, in id order. */
  heap?: readonly HeapNode[];
  /** Snapshot position, used to re-animate value rows per change. */
  stepIndex?: number;
  /** Node ids created since the previous snapshot (highlight as new). */
  addedIds?: readonly string[];
  /** Node ids whose content changed since the previous snapshot. */
  changedIds?: readonly string[];
  /** Extra classes merged into the panel surface (layout only). */
  className?: string;
}

const TYPE_STYLES = {
  object: {
    icon: Braces,
    chipClass: "bg-heap/10 text-heap",
    label: "object",
  },
  array: {
    icon: List,
    chipClass: "bg-secondary/10 text-secondary",
    label: "array",
  },
} as const;

/**
 * Renders the runtime heap below the Variables panel. One card per allocated
 * node, keyed by its stable reference id so Framer Motion animates allocation,
 * mutation, array growth and shrinkage across timeline steps.
 */
export function HeapPanel({ heap, stepIndex, addedIds, changedIds, className }: HeapPanelProps) {
  const nodes = useMemo(() => heap ?? [], [heap]);
  const added = useMemo(
    () => (addedIds ? new Set(addedIds) : new Set<string>()),
    [addedIds],
  );
  const changed = useMemo(
    () => (changedIds ? new Set(changedIds) : new Set<string>()),
    [changedIds],
  );

  return (
    <Panel className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-heap" />
          <span className="text-sm font-medium text-ink-secondary">Heap</span>
        </div>
        {nodes.length > 0 && (
          <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-ink-muted tabular-nums">
            {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center">
            <Boxes className="h-5 w-5 text-ink-disabled" />
            <p className="text-xs font-medium text-ink-muted">Heap is empty</p>
            <p className="text-xs leading-5 text-ink-disabled">
              Objects and arrays appear here once they are created.
            </p>
          </div>
        ) : (
          <motion.ol layout className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {nodes.map((node) => (
                <HeapCard
                  key={node.id}
                  node={node}
                  stepIndex={stepIndex}
                  isNew={added.has(node.id)}
                  isChanged={changed.has(node.id)}
                />
              ))}
            </AnimatePresence>
          </motion.ol>
        )}
      </div>
    </Panel>
  );
}

function HeapCard({
  node,
  stepIndex,
  isNew,
  isChanged,
}: {
  node: HeapNode;
  stepIndex?: number;
  isNew: boolean;
  isChanged: boolean;
}) {
  const style = TYPE_STYLES[node.type];
  const Icon = style.icon;
  const referenceNumber = node.id.replace("ref_", "");

  const rows = useMemo(() => {
    if (node.type === "object") return Object.entries(node.properties);
    return node.elements.map((value, index) => [`${index}`, value] as const);
  }, [node]);

  return (
    <motion.li
      layout
      layoutId={`heap-node-${node.id}`}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-surface-glass",
        isNew && "border-heap/30 shadow-[0_0_20px_-6px_rgba(52,211,153,0.35)]",
        isChanged && "border-loops/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-heap" />
          <span className="truncate font-mono text-[13px] font-semibold text-ink-primary">
            Reference #{referenceNumber}
          </span>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              style.chipClass,
            )}
          >
            {style.label}
          </span>
          {node.type === "array" && (
            <span className="rounded-md bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-ink-muted tabular-nums">
              length {node.elements.length}
            </span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 pb-2.5">
          <span className="text-[10px] text-ink-disabled">
            {node.type === "object" ? "no properties" : "no elements"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 px-3 pb-2.5">
          <AnimatePresence initial={false}>
            {rows.map(([key, value]) => {
              const display = formatDisplayValue(value);
              return (
                <motion.div
                  layout
                  key={key}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-glass px-2 py-1"
                >
                  <span className="truncate font-mono text-[11px] text-ink-muted">
                    {node.type === "array" ? `[${key}]` : key}
                  </span>
                  <motion.span
                    key={`${key}-${display}-${stepIndex}`}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "truncate font-mono text-[12px] font-medium tabular-nums",
                      value === undefined
                        ? "italic text-ink-muted"
                        : typeof value === "string"
                          ? "text-heap"
                          : typeof value === "number"
                            ? "text-console"
                            : "text-secondary",
                    )}
                  >
                    {display}
                  </motion.span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.li>
  );
}
