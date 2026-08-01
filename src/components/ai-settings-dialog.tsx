"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { AI_PROVIDER_META, SUGGESTED_MODELS } from "@/ai";
import type { AIProviderKind } from "@/ai";
import type { AiSettings, ProviderAvailability } from "@/hooks/use-ai-explain";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface AiSettingsDialogProps {
  open: boolean;
  settings: AiSettings;
  availability: ProviderAvailability;
  onSave: (next: AiSettings) => void;
  onClose: () => void;
}

const PROVIDERS: readonly AIProviderKind[] = ["openai", "gemini", "mock"];

/**
 * AI settings dialog. Provider / model / temperature / streaming / cache are
 * editable; API keys never are — they are read from the server environment and
 * only their presence is reported (see /api/ai/config).
 */
export function AiSettingsDialog({ open, settings, availability, onSave, onClose }: AiSettingsDialogProps) {
  const [draft, setDraft] = useState<AiSettings>(settings);

  // Refresh the draft whenever the dialog opens with fresh settings.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(settings);
  }

  const set = (patch: Partial<AiSettings>) => setDraft((prev) => ({ ...prev, ...patch }));

  const chooseProvider = (provider: AIProviderKind) => {
    set({
      provider,
      model: AI_PROVIDER_META[provider].defaultModel,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md"
          >
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">AI settings</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close settings"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-5 py-4">
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Provider
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PROVIDERS.map((kind) => {
                      const meta = AI_PROVIDER_META[kind];
                      const configured = availability.configured[kind];
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => chooseProvider(kind)}
                          className={cn(
                            "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors",
                            draft.provider === kind
                              ? "border-sky-400/40 bg-sky-400/10"
                              : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]",
                          )}
                        >
                          <span className="text-xs font-medium text-zinc-200">{meta.label}</span>
                          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                            {configured ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                            )}
                            {configured
                              ? "Ready"
                              : kind === "mock"
                                ? "Always available"
                                : `Set ${meta.envKey}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Model
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <input
                      list="ai-model-suggestions"
                      value={draft.model}
                      onChange={(event) => set({ model: event.target.value })}
                      spellCheck={false}
                      className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-400/40 focus:outline-none"
                    />
                    <datalist id="ai-model-suggestions">
                      {SUGGESTED_MODELS[draft.provider].map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="ai-temperature" className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Temperature
                    </label>
                    <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                      {draft.temperature.toFixed(1)}
                    </span>
                  </div>
                  <input
                    id="ai-temperature"
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={draft.temperature}
                    onChange={(event) => set({ temperature: Number(event.target.value) })}
                    className="h-1.5 w-full cursor-pointer accent-sky-400"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
                    <span>precise</span>
                    <span>creative</span>
                  </div>
                </section>

                <section className="flex flex-col gap-2.5">
                  <ToggleRow
                    label="Stream responses"
                    hint="Show the explanation as it is generated."
                    checked={draft.stream}
                    onChange={(checked) => set({ stream: checked })}
                  />
                  <ToggleRow
                    label="Cache explanations"
                    hint="Reuse answers for the same snapshot + provider + model."
                    checked={draft.cacheEnabled}
                    onChange={(checked) => set({ cacheEnabled: checked })}
                  />
                </section>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onSave(draft);
                    onClose();
                  }}
                >
                  Save
                </Button>
              </div>
            </Panel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-zinc-200">{label}</span>
        <span className="text-[11px] text-zinc-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-sky-400"
      />
    </label>
  );
}
