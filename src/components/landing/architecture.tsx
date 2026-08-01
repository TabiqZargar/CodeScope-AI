"use client";

import { motion } from "framer-motion";
import { ArrowRight, Code2, GitGraph, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { label: "Source Code", detail: "Your JavaScript", icon: Code2 },
  { label: "Parser", detail: "Babel AST", icon: null },
  { label: "Interpreter", detail: "Hand-written, safe", icon: null },
  { label: "Immutable Snapshots", detail: "One per step", icon: null },
  { label: "Timeline · Graph · AI", detail: "Render only", icon: GitGraph },
];

export function Architecture() {
  return (
    <section id="architecture" className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-xl">
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            A safe, pure pipeline
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 md:text-base">
            Source never runs through <code className="rounded bg-white/[0.06] px-1 text-[12px] text-zinc-300">eval</code> or
            the VM. A Babel parse feeds a small interpreter that emits immutable
            snapshots; the UI only renders.
          </p>
        </div>

        <div className="mt-12 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          {STAGES.map((stage, index) => {
            const Icon = stage.icon ? stage.icon : Sparkles;
            const isLast = index === STAGES.length - 1;
            return (
              <div key={stage.label} className="flex flex-1 flex-col items-stretch gap-3 lg:flex-row lg:items-center">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.35, delay: index * 0.08 }}
                  className={cn(
                    "flex flex-1 flex-col gap-1 rounded-2xl border p-4 transition-colors",
                    isLast
                      ? "border-sky-400/25 bg-gradient-to-br from-sky-500/[0.1] to-indigo-500/[0.1]"
                      : "border-white/[0.07] bg-white/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", isLast ? "text-sky-300" : "text-zinc-500")} />
                    <span className="text-sm font-semibold text-white">{stage.label}</span>
                  </div>
                  <span className="text-[11px] text-zinc-500">{stage.detail}</span>
                </motion.div>
                {!isLast ? (
                  <ArrowRight className="hidden h-4 w-4 shrink-0 rotate-90 text-zinc-600 lg:block lg:rotate-0" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
