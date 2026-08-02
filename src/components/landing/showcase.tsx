"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock, Play } from "lucide-react";
import { EXAMPLE_CATEGORIES, featuredExamples } from "@/examples";
import type { Example, ExampleDifficulty } from "@/examples";
import { cn } from "@/lib/utils";

const DIFFICULTY_STYLES: Record<ExampleDifficulty, string> = {
  beginner: "border-success/30 bg-success/10 text-success",
  intermediate: "border-warning/30 bg-warning/10 text-warning",
  advanced: "border-danger/30 bg-danger/10 text-danger",
};

export function Showcase() {
  const examples = featuredExamples();
  return (
    <section id="examples" className="mx-auto max-w-6xl px-5 py-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-2xl font-bold tracking-tight text-ink-primary md:text-3xl">
            Start from an example
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted md:text-base">
            A curated gallery of pre-verified programs — every one runs through
            the sandbox and lands on a trace you can step through immediately.
          </p>
        </div>
        <a
          href="/playground"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-secondary"
        >
          Browse all examples
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {examples.map((example, index) => (
          <ShowcaseCard key={example.id} example={example} index={index} />
        ))}
      </div>
    </section>
  );
}

function ShowcaseCard({ example, index }: { example: Example; index: number }) {
  const categoryLabel = EXAMPLE_CATEGORIES.find((entry) => entry.id === example.category)?.label;
  return (
    <motion.a
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: (index % 3) * 0.06 }}
      href={`/playground?example=${encodeURIComponent(example.id)}`}
      className="group flex flex-col rounded-2xl border border-line bg-surface-glass p-5 transition-colors hover:border-primary/30"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            DIFFICULTY_STYLES[example.difficulty],
          )}
        >
          {example.difficulty}
        </span>
        <span className="text-[11px] text-ink-muted">{categoryLabel}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-muted">
          <Clock className="h-3 w-3" />~{example.estimatedRuntimeSteps} steps
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink-primary">{example.title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-muted">{example.description}</p>
      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold">
          <Play className="h-3 w-3" />
          Load example
        </span>
      </div>
    </motion.a>
  );
}
