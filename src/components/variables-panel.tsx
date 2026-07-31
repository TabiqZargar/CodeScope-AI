"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Braces } from "lucide-react";
import type { RuntimeValue, VariableRecord } from "@/engine";
import { formatDisplayValue } from "@/engine";
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
};

function styleFor(value: RuntimeValue): ValueStyle {
  if (value === null) return VALUE_STYLES.null;
  if (value === undefined) return VALUE_STYLES.undefined;
  return VALUE_STYLES[typeof value] ?? VALUE_STYLES.undefined;
}

interface VariablesPanelProps {
  variables: VariableRecord;
}

export function VariablesPanel({ variables }: VariablesPanelProps) {
  const entries = useMemo(() => Object.entries(variables), [variables]);
  const count = entries.length;

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Braces className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-medium text-zinc-200">Variables</span>
        </div>
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-500 tabular-nums">
          {count}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
                return (
                  <motion.li
                    layout
                    key={name}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5"
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
