import type { Example, ExampleCategory } from "./types";
import { EXAMPLE_CATEGORIES } from "./types";
import { BASIC_EXAMPLES } from "./data/basics";
import { ALGORITHM_EXAMPLES } from "./data/algorithms";
import { DATA_STRUCTURE_EXAMPLES } from "./data/data-structures";
import { INTERVIEW_EXAMPLES } from "./data/interview";

/**
 * The full example catalog, in stable display order.
 *
 * This is the single aggregation point for the built-in catalog. It also acts
 * as the extension seam: future community packs or cloud-synced packs can
 * register additional examples through a pack-registration function without
 * touching any data file below.
 */
export const EXAMPLES: readonly Example[] = [
  ...BASIC_EXAMPLES,
  ...ALGORITHM_EXAMPLES,
  ...DATA_STRUCTURE_EXAMPLES,
  ...INTERVIEW_EXAMPLES,
].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

const BY_ID: ReadonlyMap<string, Example> = new Map(EXAMPLES.map((example) => [example.id, example]));

/** Look up a single example by id, or `undefined` when unknown. */
export function getExampleById(id: string): Example | undefined {
  return BY_ID.get(id);
}

/** All examples, never mutated. */
export function listExamples(): readonly Example[] {
  return EXAMPLES;
}

/** Examples flagged for the landing-page showcase. */
export function featuredExamples(): readonly Example[] {
  return EXAMPLES.filter((example) => example.featured === true);
}

/** Examples in a single category, in display order. */
export function examplesByCategory(category: ExampleCategory): readonly Example[] {
  return EXAMPLES.filter((example) => example.category === category);
}

/** All categories in display order. */
export function listCategories(): readonly { id: ExampleCategory; label: string; description: string }[] {
  return EXAMPLE_CATEGORIES;
}

/** Every unique tag used across the catalog, sorted. */
export function listTags(): readonly string[] {
  const tags = new Set<string>();
  for (const example of EXAMPLES) {
    for (const tag of example.tags) tags.add(tag);
  }
  return [...tags].sort();
}

/** Count of examples per category, for badges. */
export function categoryCounts(): ReadonlyMap<ExampleCategory, number> {
  const counts = new Map<ExampleCategory, number>();
  for (const category of EXAMPLE_CATEGORIES) counts.set(category.id, 0);
  for (const example of EXAMPLES) counts.set(example.category, (counts.get(example.category) ?? 0) + 1);
  return counts;
}

/**
 * Register additional examples (the future community / cloud pack seam).
 * Unknown ids or ids that collide with the built-in catalog are ignored, and
 * the arrays are never mutated in place.
 */
const EXTRA_EXAMPLES: Example[] = [];

export function registerExamples(examples: readonly Example[]): readonly Example[] {
  for (const example of examples) {
    if (!example || typeof example.id !== "string" || !example.id) continue;
    if (BY_ID.has(example.id) || EXTRA_EXAMPLES.some((e) => e.id === example.id)) continue;
    EXTRA_EXAMPLES.push(example);
  }
  return listExamples();
}
