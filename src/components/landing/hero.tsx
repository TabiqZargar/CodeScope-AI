"use client";

import { motion } from "framer-motion";
import { ArrowRight, Github, Zap } from "lucide-react";
import { GITHUB_URL } from "./constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-sky-500/[0.14] blur-[120px]" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-indigo-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-20 text-center md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
            <Zap className="h-3 w-3 text-sky-400" />
            Browser-native visualizer · your code never leaves the page
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mx-auto mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl"
        >
          Understand JavaScript execution{" "}
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            visually.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg"
        >
          Step through an immutable trace of your code — variables, call stack,
          heap, and execution graph — with AI explanations at every snapshot.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <a
            href="/playground"
            className="group inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
          >
            Launch Playground
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]"
          >
            <Github className="h-4 w-4" />
            View GitHub
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-zinc-500"
        >
          <span>No signup</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700" />
          <span>No eval, no Function</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700" />
          <span>Immutable snapshots</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700" />
          <span>Local AI mock included</span>
        </motion.div>
      </div>
    </section>
  );
}
