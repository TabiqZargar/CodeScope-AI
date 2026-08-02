"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandLogoMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#architecture", label: "Architecture" },
  { href: "#examples", label: "Examples" },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg-primary/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            <BrandLogoMark className="h-8 w-8 rounded-lg" />
          </motion.div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-ink-primary">CodeScope</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-primary">AI</span>
          </div>
        </Link>

        <div className="ml-8 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/playground"
            className="btn-primary hidden rounded-lg px-3.5 py-2 text-sm font-semibold sm:block"
          >
            Open Playground
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Toggle navigation menu"
            className="rounded-lg p-2 text-ink-secondary transition-colors hover:bg-surface-hover md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      <div className={cn("md:hidden", menuOpen ? "block" : "hidden")}>
        <div className="mx-auto max-w-6xl space-y-1 border-t border-line px-5 py-3">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-primary"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/playground"
            onClick={() => setMenuOpen(false)}
            className="btn-primary block rounded-lg px-3 py-2 text-center text-sm font-semibold"
          >
            Open Playground
          </a>
        </div>
      </div>
    </header>
  );
}
