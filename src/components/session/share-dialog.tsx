"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ClipboardCopy,
  Download,
  FileUp,
  History,
  Link2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { SessionController } from "@/hooks/use-session";
import type { SessionError } from "@/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type Tab = "link" | "file" | "clipboard";

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "link", label: "Link" },
  { id: "file", label: "File" },
  { id: "clipboard", label: "Clipboard" },
];

interface ShareDialogProps {
  open: boolean;
  controller: SessionController;
  onClose: () => void;
}

/**
 * Session sharing dialog: Link (copy a share URL), File (export/import
 * `.codescope`, reset, restore), and Clipboard (copy the raw payload). If a
 * restore-from-URL failed, the error is surfaced here so it can be dismissed.
 */
export function ShareDialog({ open, controller, onClose }: ShareDialogProps) {
  const [tab, setTab] = useState<Tab>("link");
  const [copied, setCopied] = useState<"link" | "payload" | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const link = controller.shareLink();
  const hasSaved = controller.hasSaved();

  // Reset transient UI when the dialog opens (render-time adjustment, per the
  // "adjusting state when props change" pattern).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCopied(null);
      setDownloadReady(false);
    }
  }

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const handleCopyLink = async () => {
    if (!link.ok) return;
    if (await controller.copyShareLink()) setCopied("link");
  };

  const handleCopyPayload = async () => {
    if (await controller.copySessionPayload()) setCopied("payload");
  };

  const handleDownload = () => {
    const text = controller.exportText();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = controller.exportFileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setDownloadReady(true);
  };

  const handleImportFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = controller.importText(text);
      if (result.ok) onClose();
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            className="w-full max-w-lg"
          >
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <span className="text-sm font-medium text-ink-secondary">Share session</span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close share dialog"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {controller.urlError && (
                <UrlErrorBanner error={controller.urlError} onDismiss={controller.clearUrlError} />
              )}

              <div className="flex gap-1 border-b border-line px-3 pt-3">
                {TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      tab === id
                        ? "bg-primary/[0.15] text-ink-primary ring-1 ring-inset ring-primary/30"
                        : "text-ink-muted hover:bg-surface-hover hover:text-ink-secondary",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-4">
                {tab === "link" && (
                  <LinkTab
                    link={link}
                    copied={copied === "link"}
                    onCopy={handleCopyLink}
                    onDownload={handleDownload}
                  />
                )}
                {tab === "file" && (
                  <FileTab
                    hasSaved={hasSaved}
                    downloadReady={downloadReady}
                    onDownload={handleDownload}
                    onImportClick={() => fileInputRef.current?.click()}
                    onReset={controller.resetWorkspace}
                    onRestore={controller.restoreLast}
                  />
                )}
                {tab === "clipboard" && (
                  <ClipboardTab copied={copied === "payload"} onCopy={handleCopyPayload} />
                )}

                <SessionStatusRow controller={controller} />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".codescope,application/json"
                className="hidden"
                onChange={(event) => handleImportFile(event.target.files?.[0] ?? null)}
              />
            </Panel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function UrlErrorBanner({ error, onDismiss }: { error: SessionError; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 border-b border-danger/20 bg-danger/10 px-5 py-3">
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-danger">
        <span className="font-semibold">Could not restore the shared link.</span> {error.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="rounded p-0.5 text-danger/70 transition-colors hover:text-danger"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface LinkTabProps {
  link: ReturnType<SessionController["shareLink"]>;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}

function LinkTab({ link, copied, onCopy, onDownload }: LinkTabProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 text-ink-muted">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed">
          Anyone with this link opens the full workspace in CodeScope — no account needed. Your code
          is compressed into the URL itself.
        </p>
      </div>

      {link.ok ? (
        <>
          <input
            readOnly
            value={link.url}
            aria-label="Share link"
            className="h-9 w-full rounded-lg border border-line-strong bg-surface-glass px-3 font-mono text-[11px] text-ink-secondary focus:border-primary/40 focus:outline-none"
          />
          <Button size="sm" onClick={onCopy} className="self-end">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copied" : "Copy share link"}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-line-strong bg-surface-glass px-4 py-3">
          <p className="text-xs leading-relaxed text-ink-secondary">
            This session is too large for a share link ({link.length.toLocaleString()} chars, limit{" "}
            {link.maxLength.toLocaleString()}). Download it as a file instead — it round-trips
            exactly the same.
          </p>
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={onDownload}>
              <Download className="h-4 w-4" />
              Download session file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FileTabProps {
  hasSaved: boolean;
  downloadReady: boolean;
  onDownload: () => void;
  onImportClick: () => void;
  onReset: () => void;
  onRestore: () => void;
}

function FileTab({ hasSaved, downloadReady, onDownload, onImportClick, onReset, onRestore }: FileTabProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={onDownload}>
          <Download className="h-4 w-4" />
          {downloadReady ? "Downloaded" : "Download .codescope"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onImportClick}>
          <FileUp className="h-4 w-4" />
          Import session…
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset} className="text-ink-muted hover:text-danger">
          <Trash2 className="h-4 w-4" />
          Reset workspace
        </Button>
        <Button size="sm" variant="ghost" onClick={onRestore} disabled={!hasSaved}>
          <History className="h-4 w-4" />
          Restore last session
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-muted">
        Sessions save as <code className="font-mono text-ink-secondary">.codescope</code> files — a
        single JSON document with your code, breakpoints, watches, view, speed and preferences.
        Invalid or foreign files are rejected on import.
      </p>
    </div>
  );
}

function ClipboardTab({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 text-ink-muted">
        <ClipboardCopy className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed">
          Copy the compressed payload. Paste it anywhere, and anyone can restore it with the
          <code className="font-mono text-ink-secondary"> Import session</code> action or a share link.
        </p>
      </div>
      <Button size="sm" onClick={onCopy} className="self-end">
        {copied ? <Check className="h-4 w-4 text-success" /> : <ClipboardCopy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy session payload"}
      </Button>
    </div>
  );
}

function SessionStatusRow({ controller }: { controller: SessionController }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface-glass px-3 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
          <Save className="h-3.5 w-3.5 text-primary" />
          Auto-save
        </span>
        <span className="text-[11px] text-ink-muted">
          {controller.savedAt
            ? `Saved ${new Date(controller.savedAt).toLocaleTimeString()}`
            : controller.autoSaveEnabled
              ? "Waiting for changes…"
              : "Auto-save is off"}
        </span>
      </span>
      <input
        type="checkbox"
        checked={controller.autoSaveEnabled}
        onChange={(event) => controller.setAutoSaveEnabled(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-primary"
      />
    </label>
  );
}

/** A trigger for the share dialog, for headers/toolbars. */
export function ShareSessionButton({
  onClick,
  restoredFromUrl,
}: {
  onClick: () => void;
  restoredFromUrl?: boolean;
}) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick} aria-label="Share or manage this session">
      <Link2 className="h-4 w-4" />
      {restoredFromUrl ? "Restored" : "Share"}
    </Button>
  );
}
