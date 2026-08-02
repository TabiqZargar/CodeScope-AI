"use client";

import { motion } from "framer-motion";
import {
  CircleDot,
  Database,
  Eye,
  Flag,
  GitGraph,
  Layers,
  ListOrdered,
  Share2,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    title: "Step-by-step execution",
    description:
      "Every statement becomes an immutable snapshot you can step through, forward and backward, without re-running.",
    icon: ListOrdered,
  },
  {
    title: "Time travel debugging",
    description:
      "Scrub anywhere in the trace. Diffing highlights exactly what changed between any two steps.",
    icon: CircleDot,
  },
  {
    title: "Call stack",
    description:
      "Watch frames push and pop as functions enter and return, with each frame's parameters and locals.",
    icon: Layers,
  },
  {
    title: "Heap visualization",
    description:
      "Objects and arrays live on a live heap view, so reference semantics and aliasing become visible.",
    icon: Database,
  },
  {
    title: "Execution graph",
    description:
      "Branches, loop back-edges, and call/return edges drawn as a navigable control-flow graph.",
    icon: GitGraph,
  },
  {
    title: "AI explanations",
    description:
      "Ask for a snapshot-level explanation: a summary, the concept behind it, and what happens next.",
    icon: Sparkles,
  },
  {
    title: "Breakpoints",
    description:
      "Pause the trace at chosen lines and continue to the next breakpoint while stepping manually.",
    icon: Flag,
  },
  {
    title: "Watch expressions",
    description:
      "Track expressions across the run and see their values update on every snapshot.",
    icon: Eye,
  },
  {
    title: "Shareable sessions",
    description:
      "Export a workspace — code, timeline, breakpoints, watches — as a link or file and restore it anywhere.",
    icon: Share2,
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-xl">
        <h2 className="text-2xl font-bold tracking-tight text-ink-primary md:text-3xl">
          Built for deep understanding
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted md:text-base">
          Not a syntax highlighter. A trace of everything your code actually
          does — rendered as inspectable, immutable state.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: (index % 3) * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface-glass p-5 backdrop-blur-xl transition-colors hover:border-primary/30"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/[0.08] blur-2xl transition-opacity opacity-0 group-hover:opacity-100" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 ring-1 ring-line-strong">
                <Icon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-ink-primary">{feature.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{feature.description}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
