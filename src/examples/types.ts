/**
 * Example catalog types.
 *
 * The example system is deliberately independent from the interpreter,
 * debugger, AI, and session layers: it is plain data plus pure helpers. The
 * only hard requirement is that `sourceCode` stays within the interpreter's
 * supported syntax subset, which the smoke suite verifies for every example.
 */

/** Filterable difficulty badge. */
export type ExampleDifficulty = "beginner" | "intermediate" | "advanced";

/** Top-level grouping used by the gallery's category filter. */
export type ExampleCategory = "basics" | "algorithms" | "data-structures" | "interview";

/** Canonical filterable tags shared across the catalog. */
export const EXAMPLE_TAGS = [
  "variables",
  "scope",
  "closures",
  "conditionals",
  "loops",
  "functions",
  "recursion",
  "objects",
  "arrays",
  "memory",
  "sorting",
  "search",
  "dfs",
  "bfs",
  "stack",
  "queue",
  "linked-list",
  "two-sum",
  "reverse-string",
  "palindrome",
  "memoization",
] as const;

export type ExampleTag = (typeof EXAMPLE_TAGS)[number];

/**
 * One catalog entry. `order` fixes the default sort; `featured` controls the
 * landing-page showcase. `estimatedRuntimeSteps` is a hand-verified estimate
 * of the number of timeline snapshots the code produces (see the smoke suite,
 * which runs every example and checks the estimate stays close to reality).
 */
export interface Example {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: ExampleDifficulty;
  readonly category: ExampleCategory;
  readonly tags: readonly ExampleTag[];
  /** Curated concepts this example teaches (shown in the preview pane). */
  readonly concepts: readonly string[];
  readonly learningObjectives: readonly string[];
  readonly sourceCode: string;
  readonly estimatedRuntimeSteps: number;
  readonly order: number;
  readonly featured?: boolean;
}

export const EXAMPLE_CATEGORIES: readonly {
  readonly id: ExampleCategory;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    id: "basics",
    label: "JavaScript Basics",
    description: "Variables, scope, closures, control flow, and call stacks.",
  },
  {
    id: "algorithms",
    label: "Algorithms",
    description: "Sorting, searching, and graph traversal, traced step by step.",
  },
  {
    id: "data-structures",
    label: "Data Structures",
    description: "Stacks, queues, and linked lists with visible heap state.",
  },
  {
    id: "interview",
    label: "Interview Prep",
    description: "Classic coding questions with variable, heap, and stack views.",
  },
];

export const EXAMPLE_DIFFICULTIES: readonly {
  readonly id: ExampleDifficulty;
  readonly label: string;
}[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];
