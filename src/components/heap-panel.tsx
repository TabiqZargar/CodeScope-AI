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
    chipClass: "bg-sky-400/10 text-sky-300",
    label: "object",
  },
  array: {
    icon: List,
    chipClass: "bg-emerald-400/10 text-emerald-300",
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
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Heap</span>
        </div>
        {nodes.length > 0 && (
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500 tabular-nums">
            {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-center">
            <Boxes className="h-5 w-5 text-zinc-600" />
            <p className="text-xs font-medium text-zinc-500">Heap is empty</p>
            <p className="text-xs leading-5 text-zinc-600">
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
        "overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04]",
        isNew && "border-sky-400/30",
        isChanged && "border-amber-400/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          <span className="truncate font-mono text-[13px] font-semibold text-zinc-100">
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
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 tabular-nums">
              length {node.elements.length}
            </span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 pb-2.5">
          <span className="text-[10px] text-zinc-600">
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
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2 py-1"
                >
                  <span className="truncate font-mono text-[11px] text-zinc-400">
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
                        ? "italic text-zinc-500"
                        : typeof value === "string"
                          ? "text-emerald-300"
                          : typeof value === "number"
                            ? "text-sky-300"
                            : "text-violet-300",
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
