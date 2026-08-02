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
        "relative rounded-[22px] border border-line bg-surface-glass shadow-panel backdrop-blur-[18px]",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
