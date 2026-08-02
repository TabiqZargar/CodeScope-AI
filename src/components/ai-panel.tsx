"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  CheckCheck,
  GitCompareArrows,
  GraduationCap,
  Lightbulb,
  Loader2,
  RotateCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { AI_PROVIDER_META } from "@/ai";
import type { AIProviderKind, Explanation } from "@/ai";
import type { AiExplainState, ProviderAvailability } from "@/hooks/use-ai-explain";
import type { AiSettings } from "@/hooks/use-ai-explain";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type Tab = "explain" | "concept" | "changes" | "next";

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: typeof BookOpen }> = [
  { id: "explain", label: "Explain", icon: Sparkles },
  { id: "concept", label: "Concept", icon: BookOpen },
  { id: "changes", label: "Changes", icon: GitCompareArrows },
  { id: "next", label: "Next", icon: Lightbulb },
];

interface AiPanelProps {
  state: AiExplainState;
  settings: AiSettings;
  effectiveProvider: AIProviderKind;
  availability: ProviderAvailability;
  onRetry: () => void;
  onOpenSettings: () => void;
  className?: string;
}

function ConfidenceBadge({ confidence }: { confidence: Explanation["confidence"] }) {
  const styles: Record<Explanation["confidence"], string> = {
    high: "bg-success/10 text-success",
    medium: "bg-warning/10 text-warning",
    low: "bg-danger/10 text-danger",
  };
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        styles[confidence],
      )}
    >
      {confidence}
    </span>
  );
}

/**
 * AI panel — a right-side read-only view of the snapshot explanation. It never
 * talks to providers itself: the hook owns transport, caching, and error
 * mapping; this component only renders state.
 */
export function AiPanel({
  state,
  settings,
  effectiveProvider,
  availability,
  onRetry,
  onOpenSettings,
  className,
}: AiPanelProps) {
  const [tab, setTab] = useState<Tab>("explain");
  const meta = AI_PROVIDER_META[effectiveProvider];
  const { explanation, streamingText, status, error, fromCache } = state;

  const showContent =
    status === "done" && explanation !== null;
  const showStreaming = status === "streaming" && streamingText.length > 0;

  return (
    <Panel className={cn("gradient-border flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-ai" />
          <span className="text-sm font-medium text-ink-secondary">AI Explain</span>
          {status === "done" && fromCache && (
            <span
              className="flex items-center gap-1 rounded-md bg-ai/10 px-2 py-0.5 text-[10px] font-semibold text-ai"
              title="This explanation was reused from the cache for the same snapshot."
            >
              <CheckCheck className="h-3 w-3" />
              cached
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="AI settings"
          title="AI settings"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-secondary"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              tab === id ? "text-ink-primary" : "text-ink-muted hover:text-ink-secondary",
            )}
          >
            {tab === id && (
              <motion.span
                layoutId="ai-tab-indicator"
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="pointer-events-none absolute inset-0 rounded-lg bg-primary/[0.15] ring-1 ring-inset ring-primary/30"
              />
            )}
            <Icon className="relative h-3.5 w-3.5" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {showStreaming && <div className="streaming-bar shrink-0" />}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {status === "idle" ? (
          <Empty
            icon={<Sparkles className="h-5 w-5 text-ink-disabled" />}
            title="No explanation yet"
            text="Run your code, then step through the timeline — each step gets an explanation."
          />
        ) : status === "error" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-danger/20 bg-danger/[0.04] px-4 text-center">
            <AlertCircle className="h-5 w-5 text-danger" />
            <p className="text-xs leading-5 text-danger">{error ?? "Something went wrong."}</p>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RotateCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : showStreaming ? (
          <div className="flex h-full flex-col items-start justify-center gap-3">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>
                {meta.label} is explaining step{" "}
                <span className="text-ink-secondary">{state.model ?? settings.model}</span>
              </span>
            </div>
            <p className="text-[13px] leading-6 text-ink-secondary">
              {streamingText}
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-ai align-middle" />
            </p>
          </div>
        ) : status === "loading" || status === "streaming" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-ai" />
            <p className="text-xs text-ink-muted">
              Asking {meta.label}
              {availability.loaded ? "" : " (checking providers…)"}
            </p>
          </div>
        ) : showContent && explanation ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-3"
            >
              {tab === "explain" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px] font-medium leading-6 text-ink-primary">{explanation.summary}</p>
                  <div className="rounded-xl border border-line bg-surface-glass px-3 py-2.5">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      Why this step happens
                    </p>
                    <p className="text-[12px] leading-5 text-ink-secondary">{explanation.reason}</p>
                  </div>
                </div>
              )}

              {tab === "concept" && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-line bg-surface-glass px-3 py-2.5">
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      <BookOpen className="h-3 w-3" />
                      Concept
                    </p>
                    <p className="text-[12px] leading-5 text-ink-secondary">{explanation.concept}</p>
                  </div>
                  <div className="rounded-xl border border-warning/15 bg-warning/[0.04] px-3 py-2.5">
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-warning/80">
                      <AlertCircle className="h-3 w-3" />
                      Common mistake
                    </p>
                    <p className="text-[12px] leading-5 text-ink-secondary">{explanation.commonMistake}</p>
                  </div>
                </div>
              )}

              {tab === "changes" && (
                <div className="flex flex-col gap-1.5">
                  {explanation.changes.length === 0 ? (
                    <Empty icon={<GitCompareArrows className="h-5 w-5 text-ink-disabled" />} title="No changes" text="Nothing changed in this step." />
                  ) : (
                    explanation.changes.map((change, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-surface-glass px-3 py-2 font-mono text-[12px] text-ink-secondary"
                      >
                        {change}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === "next" && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-secondary/15 bg-secondary/[0.04] px-3 py-2.5">
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-secondary/80">
                      <Lightbulb className="h-3 w-3" />
                      What happens next
                    </p>
                    <p className="text-[12px] leading-5 text-ink-secondary">{explanation.nextStep}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <Empty icon={<Sparkles className="h-5 w-5 text-ink-disabled" />} title="No explanation yet" text="Run your code to get started." />
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-line px-4 py-2">
        {status === "done" && explanation && (
          <>
            <span className="rounded-md bg-ai/10 px-2 py-0.5 text-[10px] font-semibold text-ai">
              {meta.label}
            </span>
            {state.model && (
              <span className="rounded-md bg-surface-hover px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                {state.model}
              </span>
            )}
            <ConfidenceBadge confidence={explanation.confidence} />
          </>
        )}
        {!availability.configured[effectiveProvider] && effectiveProvider !== "mock" && (
          <span className="rounded-md bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
            API key not configured
          </span>
        )}
      </div>
    </Panel>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-center">
      {icon}
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      <p className="text-xs leading-5 text-ink-disabled">{text}</p>
    </div>
  );
}
