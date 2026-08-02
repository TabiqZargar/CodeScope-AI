"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Braces, Crosshair, GitBranch, Layers, Terminal, X } from "lucide-react";
import type { SnapshotInspection } from "@/debugger";
import { formatDisplayValue } from "@/engine";
import type { RuntimeValue } from "@/engine";
import { cn } from "@/lib/utils";

interface SnapshotInspectorProps {
  inspection: SnapshotInspection | null;
  onClose: () => void;
}

function ValueRow({ name, value }: { name: string; value: RuntimeValue }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <span className="min-w-0 truncate font-mono text-[11px] text-zinc-400">{name}</span>
      <span
        className={cn(
          "max-w-[55%] truncate font-mono text-[12px] font-medium tabular-nums",
          value === undefined
            ? "italic text-zinc-500"
            : typeof value === "string"
              ? "text-emerald-300"
              : typeof value === "number"
                ? "text-sky-300"
                : typeof value === "boolean"
                  ? "text-amber-300"
                  : "text-violet-300",
        )}
      >
        {formatDisplayValue(value)}
      </span>
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Braces;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      {children}
    </section>
  );
}

/**
 * Snapshot Inspector drawer. A read-only window into one immutable snapshot:
 * step, line, type, variables (with change markers), call stack, heap,
 * console output and any condition/loop context. Opened from the timeline or
 * graph; closing just hides it — state stays on the snapshots.
 */
export function SnapshotInspector({ inspection, onClose }: SnapshotInspectorProps) {
  const changeMap = useMemo(
    () =>
      inspection
        ? new Map(inspection.diff.changedVariables.map((change) => [change.name, change]))
        : new Map<string, { before: RuntimeValue }>(),
    [inspection],
  );

  const open = inspection !== null;

  return (
    <AnimatePresence>
      {open && inspection && (
        <motion.aside
          key="snapshot-inspector"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="fixed bottom-0 right-0 top-0 z-50 flex w-[380px] flex-col border-l border-white/[0.08] bg-[#0d1017]/95 shadow-2xl backdrop-blur-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-medium text-zinc-200">Snapshot Inspector</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-sky-400/10 px-2 py-0.5 text-[11px] font-bold text-sky-300 tabular-nums">
                Step {inspection.step}
              </span>
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-zinc-400 tabular-nums">
                L{inspection.line}
              </span>
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {inspection.type}
              </span>
              {inspection.condition && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums",
                    inspection.conditionResult
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-rose-400/10 text-rose-300",
                  )}
                >
                  <GitBranch className="h-3 w-3" />
                  {inspection.conditionResult ? "TRUE" : "FALSE"}
                </span>
              )}
            </div>

            <p className="mb-4 text-[13px] leading-5 text-zinc-300">{inspection.description}</p>

            <div className="flex flex-col gap-4">
              <Section icon={Layers} label="Variables">
                {Object.keys(inspection.variables).length === 0 ? (
                  <Empty label="no variables" />
                ) : (
                  <div className="flex flex-col gap-1">
                    {Object.entries(inspection.variables).map(([name, value]) => {
                      const change = changeMap.get(name);
                      return (
                        <div key={name} title={change ? `was ${formatDisplayValue(change.before)}` : undefined}>
                          <ValueRow name={name} value={value} />
                          {change && (
                            <div className="mt-0.5 flex items-center gap-1 px-2.5">
                              <span className="text-[9px] text-zinc-600">was</span>
                              <span className="font-mono text-[10px] italic text-zinc-500">
                                {formatDisplayValue(change.before)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section icon={Braces} label="Call stack">
                {inspection.callStack.length === 0 ? (
                  <Empty label="top level" />
                ) : (
                  <div className="flex flex-col gap-1">
                    {inspection.callStack.map((frame) => (
                      <div key={frame.name} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <span className="font-mono text-[11px] font-medium text-cyan-300">
                          {frame.name}()
                        </span>
                        <div className="mt-1 flex flex-col gap-1">
                          {Object.entries(frame.variables).map(([name, value]) => (
                            <ValueRow key={name} name={name} value={value} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section icon={Boxes} label="Heap">
                {inspection.heap.length === 0 ? (
                  <Empty label="empty" />
                ) : (
                  <div className="flex flex-col gap-1">
                    {inspection.heap.map((node) => (
                      <div key={node.id} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <span className="font-mono text-[11px] font-semibold text-violet-300">
                          {node.id}
                        </span>
                        <div className="mt-1 flex flex-col gap-1">
                          {node.type === "object"
                            ? Object.entries(node.properties).map(([key, value]) => (
                                <ValueRow key={key} name={key} value={value} />
                              ))
                            : node.elements.map((value, i) => (
                                <ValueRow key={i} name={`[${i}]`} value={value} />
                              ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section icon={Terminal} label="Console">
                {inspection.console.length === 0 ? (
                  <Empty label="no output" />
                ) : (
                  <div className="flex flex-col gap-1">
                    {inspection.console.map((line, i) => (
                      <code key={i} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-fuchsia-300">
                        {line}
                      </code>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-white/[0.07] px-2.5 py-2 text-[11px] text-zinc-600">{label}</div>;
}
