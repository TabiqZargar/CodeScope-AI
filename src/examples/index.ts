export type {
  Example,
  ExampleCategory,
  ExampleDifficulty,
  ExampleTag,
} from "./types";
export {
  EXAMPLE_CATEGORIES,
  EXAMPLE_DIFFICULTIES,
  EXAMPLE_TAGS,
} from "./types";

export {
  categoryCounts,
  examplesByCategory,
  EXAMPLES,
  featuredExamples,
  getExampleById,
  listCategories,
  listExamples,
  listTags,
  registerExamples,
} from "./registry";

export type { ExampleFilters, ExampleSort } from "./search";
export {
  filterExamples,
  matchScore,
  normalizeQuery,
  searchExamples,
  sortExamples,
} from "./search";

export type { ExampleStorageLike } from "./history";
export {
  clearFavorites,
  clearRecent,
  createLocalStorageStorage,
  createMemoryStorage,
  FAVORITES_KEY,
  isFavorite,
  loadFavorites,
  loadRecent,
  MAX_RECENT,
  RECENT_KEY,
  recordRecent,
  saveFavorites,
  saveRecent,
  toggleFavorite,
} from "./history";
