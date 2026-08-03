"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { TOUR_STEPS, clampStep, type TourStep } from "./tour-state";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface GuidedTourProps {
  open: boolean;
  /** Persist "seen" (completion or skip) and close. */
  onClose: () => void;
}

const PADDING = 6;

/** Measure a target element's box in viewport coordinates. */
function measureTarget(target: string): Box | null {
  const element = document.querySelector<HTMLElement>(`[data-tour-step="${target}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

export function GuidedTour({ open, onClose }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const stepRef = useRef(stepIndex);

  const step: TourStep = TOUR_STEPS[stepIndex];

  // Keep the latest step index reachable from the stable resize/scroll handler
  // without ever touching the ref during render.
  useEffect(() => {
    stepRef.current = stepIndex;
  }, [stepIndex]);

  const refreshBox = useCallback(() => {
    const target = TOUR_STEPS[stepRef.current].target;
    setBox(measureTarget(target));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const target = TOUR_STEPS[stepIndex].target;
    const element = document.querySelector<HTMLElement>(`[data-tour-step="${target}"]`);
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const timer = window.setTimeout(() => setBox(measureTarget(target)), 60);
    return () => window.clearTimeout(timer);
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", refreshBox);
    window.addEventListener("scroll", refreshBox, true);
    return () => {
      window.removeEventListener("resize", refreshBox);
      window.removeEventListener("scroll", refreshBox, true);
    };
  }, [open, refreshBox]);

  // Any target missing from the DOM (e.g. panel hidden) still renders the
  // tooltip centered, so the tour is never a dead end.
  const tooltipBox = useMemo(() => {
    if (!box) {
      return { top: 0, left: 0, width: 0, height: 0, centered: true };
    }
    const width = Math.min(Math.max(box.width, 220), 360, Math.max(160, window.innerWidth - 24));
    const placement = step.placement;
    let top = box.top + box.height + 14;
    let left = box.left + box.width / 2 - width / 2;
    if (placement === "top") {
      top = box.top - 14;
    }
    if (placement === "left") {
      top = box.top + box.height / 2;
      left = box.left - 14;
    }
    if (placement === "right") {
      top = box.top + box.height / 2;
      left = box.left + box.width + 14;
    }
    // Keep the tooltip on screen.
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    top = placement === "top" ? Math.max(12, top) : Math.min(Math.max(12, top), window.innerHeight - 200);
    return { top, left, width, height: 0, centered: false };
  }, [box, step.placement]);

  if (!open) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const finish = () => {
    onClose();
    setStepIndex(0);
  };
  const goNext = () => {
    if (isLast) {
      finish();
    } else {
      setStepIndex((index) => clampStep(index + 1));
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Dimmable backdrop over everything except the highlighted element. */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={goNext} />

      {/* Highlight ring around the active element. */}
      <AnimatePresence>
        {box && !tooltipBox.centered ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute rounded-xl border-2 border-primary shadow-[0_0_0_4px_rgba(117,104,255,0.25)]"
            style={box}
          />
        ) : null}
      </AnimatePresence>

      {/* Tooltip card. */}
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="fixed z-10 rounded-2xl border border-line-strong bg-canvas-elevated p-4 shadow-2xl shadow-black/50"
        style={{
          top: tooltipBox.centered ? "40%" : tooltipBox.top,
          left: tooltipBox.centered ? "50%" : tooltipBox.left,
          width: tooltipBox.centered ? 360 : tooltipBox.width,
          transform: tooltipBox.centered ? "translate(-50%, -50%)" : undefined,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Step {stepIndex + 1} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="Dismiss tour"
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <h3 className="mt-2 text-[15px] font-semibold text-ink-primary">{step.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{step.description}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((tourStep, index) => (
              <span
                key={tourStep.id}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  index === stepIndex ? "bg-primary" : "bg-surface-hover"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={finish}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink-primary"
            >
              Skip
            </button>
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((index) => clampStep(index - 1))}
                className="rounded-lg border border-line-strong bg-surface-glass px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="btn-primary px-3 py-1.5 text-xs font-semibold"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
