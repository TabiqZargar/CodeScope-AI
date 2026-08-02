"use client";

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronRight,
  Clock,
  Heart,
  Play,
  Search,
  X,
} from "lucide-react";
import {
  EXAMPLE_CATEGORIES,
  EXAMPLE_DIFFICULTIES,
  createLocalStorageStorage,
  filterExamples,
  listExamples,
  listTags,
  loadFavorites,
  loadRecent,
  recordRecent,
  sortExamples,
  toggleFavorite,
} from "@/examples";
import type {
  Example,
  ExampleCategory,
  ExampleDifficulty,
  ExampleSort,
} from "@/examples";
import { cn } from "@/lib/utils";

type ViewMode = "all" | "favorites" | "recent";

interface ExampleGalleryProps {
  open: boolean;
  onClose: () => void;
  /** Apply an example in the playground (sets code, runs, seeks to step 0). */
  onLoad: (example: Example) => void;
}

const DIFFICULTY_STYLES: Record<ExampleDifficulty, string> = {
  beginner: "border-success/30 bg-success/10 text-success",
  intermediate: "border-warning/30 bg-warning/10 text-warning",
  advanced: "border-danger/30 bg-danger/10 text-danger",
};

export function ExampleGallery({ open, onClose, onLoad }: ExampleGalleryProps) {
  const storage = useMemo(() => createLocalStorageStorage(), []);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExampleCategory | null>(null);
  const [difficulty, setDifficulty] = useState<ExampleDifficulty | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<ExampleSort>("featured");
  const [view, setView] = useState<ViewMode>("all");
  const [selected, setSelected] = useState<Example | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites(storage));
  const [recent, setRecent] = useState<string[]>(() => loadRecent(storage));
  const [allExamples] = useState<readonly Example[]>(listExamples);

  // Refresh favorites/recents whenever the gallery (re)opens using standard derived state.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setFavorites(loadFavorites(storage));
      setRecent(loadRecent(storage));
    }
  }

  const toggleFavoriteFor = useCallback(
    (id: string) => {
      const nowFavorite = toggleFavorite(storage, id);
      setFavorites(loadFavorites(storage));
      if (selected && selected.id === id) {
        setSelected((prev) => (prev ? { ...prev } : prev));
      }
      return nowFavorite;
    },
    [storage, selected],
  );

  const record = useCallback(
    (id: string) => setRecent(recordRecent(storage, id)),
    [storage],
  );

  const close = useCallback(() => {
    onClose();
    setSelected(null);
    setQuery("");
    setCategory(null);
    setDifficulty(null);
    setTag(null);
  }, [onClose]);

  const filtered = useMemo(() => {
    let base: readonly Example[] = allExamples;
    if (view === "favorites") {
      base = allExamples.filter((example) => favorites.includes(example.id));
    } else if (view === "recent") {
      base = recent
        .map((id) => allExamples.find((example) => example.id === id))
        .filter((example): example is Example => example !== undefined);
    }
    return sortExamples(
      filterExamples(base, { query, category, difficulty, tag }),
      sort,
    );
  }, [allExamples, favorites, recent, view, query, category, difficulty, tag, sort]);

  const tags = useMemo(() => listTags(), []);

  const load = (example: Example) => {
    record(example.id);
    onLoad(example);
    close();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/70 p-2 backdrop-blur-sm md:p-6"
          onClick={close}
        >
          <motion.div
            initial={{ y: 24, scale: 0.985 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-canvas-elevated shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/90 to-secondary/90">
                <BookOpen className="h-4 w-4 text-canvas" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold text-ink-primary">Example Gallery</span>
                <span className="mt-0.5 text-[11px] text-ink-muted">
                  {allExamples.length} programs, pre-verified against the interpreter
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close gallery"
                  className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* Filters + list */}
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="space-y-3 px-4 pb-3 pt-3 md:px-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <label className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search by title, description, tag, or concept…"
                        className="w-full rounded-lg border border-line-strong bg-surface-glass py-2 pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-disabled focus:border-primary/50 focus:outline-none"
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value as ExampleSort)}
                        aria-label="Sort examples"
                        className="rounded-lg border border-line-strong bg-surface-glass px-2.5 py-2 text-xs text-ink-secondary focus:border-primary/50 focus:outline-none"
                      >
                        <option value="featured">Featured</option>
                        <option value="title">Title A–Z</option>
                        <option value="steps">Fewest steps</option>
                      </select>
                      <div className="flex rounded-lg border border-line-strong bg-surface-glass p-0.5">
                        {(["all", "favorites", "recent"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setView(mode)}
                            className={cn(
                              "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                              view === mode
                                ? "bg-primary/[0.15] text-primary"
                                : "text-ink-muted hover:text-ink-secondary",
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <FilterChip
                      active={category === null}
                      label="All categories"
                      onClick={() => setCategory(null)}
                    />
                    {EXAMPLE_CATEGORIES.map((entry) => (
                      <FilterChip
                        key={entry.id}
                        active={category === entry.id}
                        label={entry.label}
                        onClick={() => setCategory(category === entry.id ? null : entry.id)}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {EXAMPLE_DIFFICULTIES.map((entry) => (
                      <FilterChip
                        key={entry.id}
                        active={difficulty === entry.id}
                        label={entry.label}
                        onClick={() => setDifficulty(difficulty === entry.id ? null : entry.id)}
                      />
                    ))}
                    <select
                      value={tag ?? ""}
                      onChange={(event) => setTag(event.target.value || null)}
                      aria-label="Filter by tag"
                      className="rounded-lg border border-line-strong bg-surface-glass px-2.5 py-1 text-xs text-ink-secondary focus:border-primary/50 focus:outline-none"
                    >
                      <option value="">All tags</option>
                      {tags.map((tagName) => (
                        <option key={tagName} value={tagName}>
                          {tagName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-5">
                  {filtered.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                      {filtered.map((example) => (
                        <ExampleCard
                          key={example.id}
                          example={example}
                          selected={selected?.id === example.id}
                          favorite={favorites.includes(example.id)}
                          onSelect={() => setSelected(example)}
                          onToggleFavorite={() => toggleFavoriteFor(example.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview pane */}
              {selected ? (
                <aside className="flex w-full shrink-0 flex-col border-t border-line bg-surface-glass/40 md:w-[340px] md:border-l md:border-t-0">
                  <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            DIFFICULTY_STYLES[selected.difficulty],
                          )}
                        >
                          {selected.difficulty}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                          <Clock className="h-3 w-3" />~{selected.estimatedRuntimeSteps} steps
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-ink-primary">{selected.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                        {selected.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFavoriteFor(selected.id)}
                      aria-label={favorites.includes(selected.id) ? "Remove favorite" : "Add favorite"}
                      className={cn(
                        "rounded-lg p-2 transition-colors",
                        favorites.includes(selected.id)
                          ? "text-danger"
                          : "text-ink-muted hover:text-danger",
                      )}
                    >
                      <Heart className={cn("h-4 w-4", favorites.includes(selected.id) && "fill-danger")} />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                    <pre className="rounded-xl border border-line bg-canvas p-3 text-[11px] leading-relaxed text-ink-secondary">
                      {selected.sourceCode}
                    </pre>

                    <Section label="Concepts covered">
                      <div className="flex flex-wrap gap-1.5">
                        {selected.concepts.map((concept) => (
                          <span
                            key={concept}
                            className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] text-ink-secondary"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    </Section>

                    <Section label="Learning objectives">
                      <ul className="space-y-1.5">
                        {selected.learningObjectives.map((objective) => (
                          <li key={objective} className="flex gap-2 text-xs leading-relaxed text-ink-secondary">
                            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                            {objective}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  </div>

                  <div className="border-t border-line p-4">
                    <button
                      type="button"
                      data-tour-step="1b"
                      onClick={() => load(selected)}
                      className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
                    >
                      <Play className="h-4 w-4" />
                      Load in playground
                    </button>
                  </div>
                </aside>
              ) : (
                <div className="hidden w-[340px] shrink-0 items-center justify-center border-l border-line md:flex">
                  <p className="max-w-[200px] text-center text-xs leading-relaxed text-ink-disabled">
                    Select an example to preview its code, concepts, and learning objectives.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-line-strong bg-surface-glass text-ink-muted hover:text-ink-secondary",
      )}
    >
      {label}
    </button>
  );
}

function ExampleCard({
  example,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
}: {
  example: Example;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const categoryLabel = EXAMPLE_CATEGORIES.find((entry) => entry.id === example.category)?.label;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-line bg-surface-glass hover:border-line-active hover:bg-surface-hover",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              DIFFICULTY_STYLES[example.difficulty],
            )}
          >
            {example.difficulty}
          </span>
          <span className="text-[10px] text-ink-muted">{categoryLabel}</span>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.stopPropagation();
              onToggleFavorite();
            }
          }}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          className={cn(
            "-m-1 rounded-lg p-1 transition-colors",
            favorite ? "text-danger" : "text-ink-disabled group-hover:text-ink-muted",
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", favorite && "fill-danger")} />
        </span>
      </div>
      <h4 className="mt-2 text-sm font-semibold text-ink-primary">{example.title}</h4>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{example.description}</p>
      <div className="mt-2.5 flex items-center gap-2 text-[10px] text-ink-muted">
        <Clock className="h-3 w-3" />
        ~{example.estimatedRuntimeSteps} steps
        <span className="ml-auto flex items-center gap-1">
          {example.tags.slice(0, 2).map((tagName) => (
            <span key={tagName} className="rounded bg-surface-hover px-1.5 py-0.5 text-ink-secondary">
              {tagName}
            </span>
          ))}
        </span>
      </div>
    </button>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-ink-disabled">{label}</h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center">
      <p className="text-center text-sm text-ink-disabled">No examples match those filters.</p>
    </div>
  );
}
