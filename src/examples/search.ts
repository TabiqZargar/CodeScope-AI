import type { Example, ExampleCategory, ExampleDifficulty } from "./types";

/**
 * Pure, React-free search and filtering over the example catalog.
 */

export interface ExampleFilters {
  readonly query: string;
  readonly category: ExampleCategory | null;
  readonly difficulty: ExampleDifficulty | null;
  readonly tag: string | null;
}

export type ExampleSort = "featured" | "title" | "steps";

/** Lowercase, whitespace-collapsed query string used for matching. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Score how well an example matches a normalized query (0 = no match). */
export function matchScore(example: Example, normalized: string): number {
  if (!normalized) return 0;
  const haystack = [
    example.title,
    example.description,
    ...example.tags,
    ...example.concepts,
  ]
    .join(" ")
    .toLowerCase();
  if (!haystack.includes(normalized)) return 0;
  if (example.title.toLowerCase().includes(normalized)) return 3;
  if (example.tags.some((tag) => tag.toLowerCase().includes(normalized))) return 2;
  if (example.concepts.some((concept) => concept.toLowerCase().includes(normalized))) return 1;
  return 1;
}

/** Examples whose title, description, tags, or concepts contain the query. */
export function searchExamples(examples: readonly Example[], query: string): readonly Example[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return examples;
  return examples
    .map((example) => ({ example, score: matchScore(example, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.example.order - b.example.order)
    .map((entry) => entry.example);
}

/** Apply query plus category / difficulty / tag filters. */
export function filterExamples(
  examples: readonly Example[],
  filters: ExampleFilters,
): readonly Example[] {
  const queried = searchExamples(examples, filters.query);
  return queried.filter((example) => {
    if (filters.category !== null && example.category !== filters.category) return false;
    if (filters.difficulty !== null && example.difficulty !== filters.difficulty) return false;
    if (filters.tag !== null && !example.tags.includes(filters.tag as Example["tags"][number])) {
      return false;
    }
    return true;
  });
}

/** Stable, deterministic sort for a filtered result set. */
export function sortExamples(examples: readonly Example[], sort: ExampleSort): readonly Example[] {
  const copy = [...examples];
  switch (sort) {
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title) || a.order - b.order);
    case "steps":
      return copy.sort((a, b) => a.estimatedRuntimeSteps - b.estimatedRuntimeSteps || a.order - b.order);
    case "featured":
    default:
      return copy.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }
}
