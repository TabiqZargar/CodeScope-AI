/**
 * Example system smoke tests.
 *
 * Verifies the entire example catalog, search engine, filter logic, local
 * history (favorites and recents), storage persistence, execution correctness
 * against the interpreter, and onboarding tour state.
 *
 * Run with: `npm run test:examples`
 */

import {
  EXAMPLES,
  filterExamples,
  getExampleById,
  searchExamples,
  sortExamples,
  createMemoryStorage,
  loadFavorites,
  toggleFavorite,
  loadRecent,
  recordRecent,
  clearFavorites,
  clearRecent,
} from "../src/examples";
import { runCode } from "../src/engine";
import {
  TOUR_STEPS,
  shouldShowTour,
  markTourSeen,
} from "../src/components/onboarding/tour-state";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("Running example smoke tests...");

// 1. Catalog integrity & execution verification
assert(EXAMPLES.length >= 20, "Catalog should have at least 20 examples");
const ids = new Set<string>();
for (const example of EXAMPLES) {
  assert(!ids.has(example.id), `Duplicate example id: ${example.id}`);
  ids.add(example.id);
  assert(example.title.length > 0, `Example ${example.id} missing title`);
  assert(example.sourceCode.length > 0, `Example ${example.id} missing source code`);
  assert(example.estimatedRuntimeSteps > 0, `Example ${example.id} invalid step estimate`);

  // Verify execution against interpreter
  const result = runCode(example.sourceCode);
  const errMsg = !result.ok ? result.error.message : "";
  assert(result.ok, `Example ${example.id} failed to execute: ${errMsg}`);
  assert(
    result.snapshots.length === example.estimatedRuntimeSteps,
    `Example ${example.id} step mismatch: estimated ${example.estimatedRuntimeSteps}, got ${result.snapshots.length}`,
  );
}
console.log(`✓ Verified all ${EXAMPLES.length} catalog examples execute correctly`);

// 2. Search & filtering
const queried = searchExamples(EXAMPLES, "bubble");
assert(queried.length === 1 && queried[0].id === "bubble-sort", "Search for 'bubble' should find bubble-sort");

const filtered = filterExamples(EXAMPLES, {
  query: "",
  category: "basics",
  difficulty: "beginner",
  tag: null,
});
assert(filtered.length > 0, "Should find beginner basics examples");
assert(filtered.every((ex) => ex.category === "basics" && ex.difficulty === "beginner"), "Filters should match");

const sorted = sortExamples(filtered, "steps");
for (let i = 0; i < sorted.length - 1; i++) {
  assert(sorted[i].estimatedRuntimeSteps <= sorted[i + 1].estimatedRuntimeSteps, "Sort by steps should be ascending");
}
console.log("✓ Search, filtering, and sorting work correctly");

// 3. Favorites & recents history
const storage = createMemoryStorage();
assert(loadFavorites(storage).length === 0, "Favorites should start empty");
const toggled = toggleFavorite(storage, "hello-variables");
assert(toggled === true, "Toggle should add favorite");
assert(loadFavorites(storage).includes("hello-variables"), "Favorites should contain hello-variables");
toggleFavorite(storage, "hello-variables");
assert(!loadFavorites(storage).includes("hello-variables"), "Toggle should remove favorite");

clearFavorites(storage);
assert(loadFavorites(storage).length === 0, "Clear favorites should empty list");

recordRecent(storage, "bubble-sort");
recordRecent(storage, "binary-search");
const recent = loadRecent(storage);
assert(recent[0] === "binary-search", "Most recent should be first");
assert(recent[1] === "bubble-sort", "Older recent should follow");

clearRecent(storage);
assert(loadRecent(storage).length === 0, "Clear recent should empty list");
console.log("✓ Favorites and recents history operate correctly");

// 4. Onboarding tour state
const tourStorage = createMemoryStorage();
assert(TOUR_STEPS.length === 6, "Tour should have exactly 6 steps");
assert(shouldShowTour(tourStorage) === true, "Tour should show initially");
markTourSeen(tourStorage);
assert(shouldShowTour(tourStorage) === false, "Tour should not show after being marked seen");
console.log("✓ Onboarding tour state operates correctly");

console.log("\nAll example smoke tests passed successfully! 🎉");
