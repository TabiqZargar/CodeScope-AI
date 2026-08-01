"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CodeXml, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#architecture", label: "Architecture" },
  { href: "#examples", label: "Examples" },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07080c]/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400/90 to-indigo-500/90 shadow-[0_8px_24px_-8px_rgba(56,189,248,0.7)]"
          >
            <CodeXml className="h-4 w-4 text-white" strokeWidth={2.2} />
          </motion.div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-white">CodeScope</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-sky-400">AI</span>
          </div>
        </Link>

        <div className="ml-8 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/playground"
            className="hidden rounded-lg bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400 sm:block"
          >
            Open Playground
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Toggle navigation menu"
            className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-white/[0.06] md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      <div className={cn("md:hidden", menuOpen ? "block" : "hidden")}>
        <div className="mx-auto max-w-6xl space-y-1 border-t border-white/[0.06] px-5 py-3">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/playground"
            onClick={() => setMenuOpen(false)}
            className="block rounded-lg bg-sky-500 px-3 py-2 text-center text-sm font-semibold text-white"
          >
            Open Playground
          </a>
        </div>
      </div>
    </header>
  );
}
