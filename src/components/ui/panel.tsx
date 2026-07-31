"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export type PanelProps = HTMLMotionProps<"div">;

/**
 * A glass panel: subtle border, faint translucent fill and backdrop blur.
 * The standard surface used for the editor, variables, and console panes.
 */
export function Panel({ className, children, ...props }: PanelProps) {
  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className={cn(
        "relative rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-[0_16px_48px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
