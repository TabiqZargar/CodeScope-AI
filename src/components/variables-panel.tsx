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
  number: { valueClass: "text-sky-300", chipClass: "bg-sky-400/10 text-sky-300", label: "number" },
  string: {
    valueClass: "text-emerald-300",
    chipClass: "bg-emerald-400/10 text-emerald-300",
    label: "string",
  },
  boolean: {
    valueClass: "text-amber-300",
    chipClass: "bg-amber-400/10 text-amber-300",
    label: "boolean",
  },
  null: { valueClass: "text-zinc-500", chipClass: "bg-zinc-400/10 text-zinc-400", label: "null" },
  undefined: {
    valueClass: "text-zinc-500 italic",
    chipClass: "bg-zinc-400/10 text-zinc-400",
    label: "undefined",
  },
  ref: {
    valueClass: "text-violet-300",
    chipClass: "bg-violet-400/10 text-violet-300",
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
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Braces className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-medium text-zinc-200">Variables</span>
        </div>
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500 tabular-nums">
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
            className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Loop
              </span>
              <span className="rounded-md bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                {LOOP_LABELS[loopType]}
              </span>
            </div>
            <span className="mt-1.5 block font-mono text-[13px] font-medium text-zinc-100">
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
            className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Condition
              </span>
              {conditionResult ? (
                <span className="flex items-center gap-1 rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  TRUE
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-md bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                  <XCircle className="h-3 w-3" />
                  FALSE
                </span>
              )}
            </div>
            <code className="mt-1.5 block truncate font-mono text-[13px] text-zinc-100">
              {condition}
            </code>
            <motion.div
              initial={false}
              animate={{ width: conditionResult ? "100%" : "0%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "mt-2.5 h-0.5 rounded-full",
                conditionResult ? "bg-emerald-400/80" : "bg-rose-400/80",
              )}
            />
          </motion.div>
        )}

        {count === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-4 text-center">
            <Braces className="h-5 w-5 text-zinc-600" />
            <p className="text-xs font-medium text-zinc-500">No variables yet</p>
            <p className="text-xs leading-5 text-zinc-600">
              Press <span className="text-zinc-400">Run</span> to trace your code.
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
                      "flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5",
                      isNew && "border-sky-400/30",
                      change && "border-amber-400/40",
                    )}
                    title={
                      change
                        ? `${name}: ${formatDisplayValue(change.before)} → ${display}`
                        : undefined
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[13px] font-medium text-zinc-100">
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
                        <span className="rounded bg-amber-400/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                          changed
                        </span>
                      )}
                      {isNew && !change && (
                        <span className="rounded bg-sky-400/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-sky-300">
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
