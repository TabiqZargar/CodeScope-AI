/**
 * Guided-tour definition and persistence.
 *
 * Pure and React-free so the smoke suite can verify the onboarding flow:
 * step order, targets, and the "seen" flag round-trip through storage.
 */

export const TOUR_SEEN_KEY = "codescope.tour.seen.v1";

export interface TourStep {
  readonly id: string;
  /** Matches a `data-tour-step` attribute in the playground. */
  readonly target: string;
  readonly title: string;
  readonly description: string;
  /** Where the tooltip sits relative to the highlighted element. */
  readonly placement: "bottom" | "top" | "left" | "right";
}

/**
 * The first-launch onboarding flow. Each step highlights one part of the
 * playground and explains what to do there.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "examples",
    target: "1",
    title: "Load an example",
    description:
      "Open the Example Gallery and pick a program. Each one comes with a difficulty badge, concepts, and estimated runtime steps.",
    placement: "bottom",
  },
  {
    id: "run",
    target: "2",
    title: "Click Run",
    description:
      "Run the code to build an immutable trace. The editor highlights the active line as execution steps are captured.",
    placement: "top",
  },
  {
    id: "step",
    target: "3",
    title: "Step through execution",
    description:
      "Move forward and back with the step buttons, or drag the timeline strip, to walk through every snapshot.",
    placement: "top",
  },
  {
    id: "variables",
    target: "4",
    title: "Inspect variables",
    description:
      "The Variables panel shows every binding at the current step, with changes and the condition outcome highlighted.",
    placement: "left",
  },
  {
    id: "graph",
    target: "5",
    title: "Open the graph",
    description:
      "Switch from Timeline to Graph to see branches, loop back-edges, and call/return edges of the whole run.",
    placement: "top",
  },
  {
    id: "ai",
    target: "6",
    title: "Ask AI",
    description:
      "Ask for an explanation of the current step — a summary, concept, and what happens next — generated from the snapshot.",
    placement: "top",
  },
];

export interface TourStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Show the tour only until it has been completed or skipped once. */
export function shouldShowTour(storage: TourStorageLike): boolean {
  try {
    return storage.getItem(TOUR_SEEN_KEY) !== "true";
  } catch {
    return true;
  }
}

/** Persist that the tour has been seen (completion and skip share this flag). */
export function markTourSeen(storage: TourStorageLike): void {
  try {
    storage.setItem(TOUR_SEEN_KEY, "true");
  } catch {
    // Best-effort; a failing store should never block the app.
  }
}

/** Clamp a step index to the valid range. */
export function clampStep(step: number): number {
  if (step < 0) return 0;
  if (step >= TOUR_STEPS.length) return TOUR_STEPS.length - 1;
  return step;
}
