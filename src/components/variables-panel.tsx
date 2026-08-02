"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Braces, CheckCircle2, XCircle } from "lucide-react";
import type { RuntimeValue, VariableRecord } from "@/engine";
import { formatDisplayValue, isHeapReference } from "@/engine";
import type { SnapshotDiff } from "@/debugger";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

interface ValueStyle {
  valueClass: string;
  chipClass: string;
  label: string;
}

const VALUE_STYLES: Record<string, ValueStyle> = {
  number: {
    valueClass: "text-console",
    chipClass: "bg-gradient-to-r from-primary/20 to-secondary/20 text-console",
    label: "number",
  },
  string: {
    valueClass: "text-heap",
    chipClass: "bg-gradient-to-r from-primary/20 to-secondary/20 text-heap",
    label: "string",
  },
  boolean: {
    valueClass: "text-loops",
    chipClass: "bg-gradient-to-r from-primary/20 to-secondary/20 text-loops",
    label: "boolean",
  },
  null: {
    valueClass: "text-ink-muted",
    chipClass: "bg-ink-disabled/20 text-ink-muted",
    label: "null",
  },
  undefined: {
    valueClass: "text-ink-muted italic",
    chipClass: "bg-ink-disabled/20 text-ink-muted",
    label: "undefined",
  },
  ref: {
    valueClass: "text-secondary",
    chipClass: "bg-gradient-to-r from-primary/20 to-secondary/20 text-secondary",
    label: "ref",
  },
};

function styleFor(value: RuntimeValue): ValueStyle {
  if (value === null) return VALUE_STYLES.null;
  if (value === undefined) return VALUE_STYLES.undefined;
  if (isHeapReference(value)) return VALUE_STYLES.ref;
  return VALUE_STYLES[typeof value] ?? VALUE_STYLES.undefined;
}

interface VariablesPanelProps {
  variables: VariableRecord;
  /** Snapshot position, used to re-animate the condition card per decision. */
  stepIndex?: number;
  /** Source text of the last evaluated condition, when the step is a decision. */
  condition?: string;
  /** Boolean outcome of the last evaluated condition, when the step is a decision. */
  conditionResult?: boolean;
  /** Loop construct the snapshot belongs to, when inside a loop. */
  loopType?: "for" | "while" | "do-while";
  /** 1-based iteration number for snapshots produced inside a loop. */
  iteration?: number;
  /** What changed since the previous snapshot; only changed rows animate. */
  diff?: SnapshotDiff;
  /** Extra classes merged into the panel surface (layout only). */
  className?: string;
}

const LOOP_LABELS: Record<NonNullable<VariablesPanelProps["loopType"]>, string> = {
  for: "FOR",
  while: "WHILE",
  "do-while": "DO-WHILE",
};

export function VariablesPanel({
  variables,
  stepIndex,
  condition,
  conditionResult,
  loopType,
  iteration,
  diff,
  className,
}: VariablesPanelProps) {
  const entries = useMemo(() => Object.entries(variables), [variables]);
  const count = entries.length;
  const isDecision = condition !== undefined && conditionResult !== undefined;

  const changesByName = useMemo(
    () =>
      diff
        ? new Map(diff.changedVariables.map((change) => [change.name, change]))
        : new Map<string, { before: RuntimeValue }>(),
    [diff],
  );
  const addedNames = useMemo(
    () => (diff ? new Set(diff.addedVariables) : new Set<string>()),
    [diff],
  );

  return (
    <Panel className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Braces className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-ink-secondary">Variables</span>
        </div>
        <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-ink-muted tabular-nums">
          {count}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {loopType && iteration !== undefined && (
          <motion.div
            key={`${stepIndex}-loop`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mb-3 rounded-xl border border-line bg-surface-glass px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Loop
              </span>
              <span className="rounded-md bg-loops/10 px-1.5 py-0.5 text-[10px] font-bold text-loops">
                {LOOP_LABELS[loopType]}
              </span>
            </div>
            <span className="mt-1.5 block font-mono text-[13px] font-medium text-ink-primary">
              Iteration {iteration}
            </span>
          </motion.div>
        )}

        {isDecision && (
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mb-3 rounded-xl border border-line bg-surface-glass px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Condition
              </span>
              {conditionResult ? (
                <span className="flex items-center gap-1 rounded-md bg-heap/10 px-1.5 py-0.5 text-[10px] font-bold text-heap">
                  <CheckCircle2 className="h-3 w-3" />
                  TRUE
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-md bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                  <XCircle className="h-3 w-3" />
                  FALSE
                </span>
              )}
            </div>
            <code className="mt-1.5 block truncate font-mono text-[13px] text-ink-primary">
              {condition}
            </code>
            <motion.div
              initial={false}
              animate={{ width: conditionResult ? "100%" : "0%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "mt-2.5 h-0.5 rounded-full",
                conditionResult ? "bg-heap/80" : "bg-danger/80",
              )}
            />
          </motion.div>
        )}

        {count === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-center">
            <Braces className="h-5 w-5 text-ink-disabled" />
            <p className="text-xs font-medium text-ink-muted">No variables yet</p>
            <p className="text-xs leading-5 text-ink-disabled">
              Press <span className="text-ink-secondary">Run</span> to trace your code.
            </p>
          </div>
        ) : (
          <motion.ul layout className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {entries.map(([name, value]) => {
                const style = styleFor(value);
                const display = formatDisplayValue(value);
                const change = changesByName.get(name);
                const isNew = addedNames.has(name);
                return (
                  <motion.li
                    layout
                    key={name}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-glass px-3 py-2.5",
                      isNew && "border-secondary/30",
                      change && "border-loops/40",
                    )}
                    title={
                      change
                        ? `${name}: ${formatDisplayValue(change.before)} → ${display}`
                        : undefined
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[13px] font-medium text-ink-primary">
                        {name}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider",
                          style.chipClass,
                        )}
                      >
                        {style.label}
                      </span>
                      {change && (
                        <span className="rounded bg-loops/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-loops">
                          changed
                        </span>
                      )}
                      {isNew && !change && (
                        <span className="rounded bg-secondary/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-secondary">
                          new
                        </span>
                      )}
                    </div>
                    <motion.span
                      key={display}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className={cn(
                        "truncate font-mono text-[13px] font-medium tabular-nums",
                        style.valueClass,
                      )}
                    >
                      {display}
                    </motion.span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </Panel>
  );
}
