"use client";

import { useEffect, useMemo, useState } from "react";
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
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-glass px-2.5 py-1.5">
      <span className="min-w-0 truncate font-mono text-[11px] text-ink-muted">{name}</span>
      <span
        className={cn(
          "max-w-[55%] truncate font-mono text-[12px] font-medium tabular-nums",
          value === undefined
            ? "italic text-ink-muted"
            : typeof value === "string"
              ? "text-heap"
              : typeof value === "number"
                ? "text-console"
                : typeof value === "boolean"
                  ? "text-loops"
                  : "text-secondary",
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
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
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

  // Below `sm` the drawer becomes a full-width bottom sheet (slides up);
  // at `sm+` it stays the right-hand rail (slides in from the right).
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const open = inspection !== null;

  return (
    <AnimatePresence>
      {open && inspection && (
        <motion.aside
          key="snapshot-inspector"
          initial={{ x: isNarrow ? 0 : "100%", y: isNarrow ? "100%" : 0 }}
          animate={{ x: 0, y: 0 }}
          exit={{ x: isNarrow ? 0 : "100%", y: isNarrow ? "100%" : 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="fixed inset-x-0 bottom-0 top-auto z-50 flex h-[85dvh] w-full flex-col rounded-t-2xl border-t border-line-strong bg-bg-elevated/95 shadow-2xl backdrop-blur-[18px] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[380px] sm:rounded-none sm:border-l sm:border-t-0"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-ink-secondary">Snapshot Inspector</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary tabular-nums">
                Step {inspection.step}
              </span>
              <span className="rounded-md bg-surface-hover px-2 py-0.5 font-mono text-[11px] text-ink-muted tabular-nums">
                L{inspection.line}
              </span>
              <span className="rounded-md bg-surface-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {inspection.type}
              </span>
              {inspection.condition && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums",
                    inspection.conditionResult
                      ? "bg-heap/10 text-heap"
                      : "bg-danger/10 text-danger",
                  )}
                >
                  <GitBranch className="h-3 w-3" />
                  {inspection.conditionResult ? "TRUE" : "FALSE"}
                </span>
              )}
            </div>

            <p className="mb-4 text-[13px] leading-5 text-ink-secondary">{inspection.description}</p>

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
                              <span className="text-[9px] text-ink-disabled">was</span>
                              <span className="font-mono text-[10px] italic text-ink-muted">
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
                      <div key={frame.name} className="rounded-lg bg-surface-glass px-2.5 py-1.5">
                        <span className="font-mono text-[11px] font-medium text-functions">
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
                      <div key={node.id} className="rounded-lg bg-surface-glass px-2.5 py-1.5">
                        <span className="font-mono text-[11px] font-semibold text-heap">
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
                      <code key={i} className="rounded-lg bg-surface-glass px-2.5 py-1.5 font-mono text-[11px] text-console">
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
  return <div className="rounded-lg border border-dashed border-line-strong px-2.5 py-2 text-[11px] text-ink-disabled">{label}</div>;
}
