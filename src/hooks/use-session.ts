"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CODE } from "@/engine";
import {
  buildShareLink,
  buildSession,
  clearStoredSession,
  compressSession,
  defaultSessionContent,
  deserializeSession,
  hasSharePayload,
  hasStoredSession,
  loadStoredSession,
  serializeSession,
  sessionContentSignature,
  shareSessionFromUrl,
  storeSession,
  stripShareParam,
} from "@/session";
import type {
  Session,
  SessionContent,
  SessionError,
  SessionMeta,
  SessionResult,
  ShareLinkResult,
} from "@/session";

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

export interface UseSessionOptions {
  /** The current workspace, rebuilt (memoized) whenever it changes. */
  content: SessionContent;
  /** Restore a workspace: code + run + index + all panels. Stable. */
  applyContent: (content: SessionContent) => void;
  /** Whether edits auto-save (default true). */
  autoSave?: boolean;
}

export interface SessionController {
  /** Epoch ms of the last successful persist (auto or explicit). */
  savedAt: number | null;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  /** Build a session object for the current content + metadata. */
  snapshot: () => Session;
  /** Persist now. Returns the saved session. */
  save: () => Session;
  /** Persist as a fresh lineage (new timestamps). */
  duplicate: () => Session;
  /** Clear stored session and reset to a fresh workspace. */
  resetWorkspace: () => void;
  /** Restore the auto-saved session. True when one existed. */
  restoreLast: () => boolean;
  hasSaved: () => boolean;
  /** Canonical JSON for file export. */
  exportText: () => string;
  exportFileName: () => string;
  /** Validate + restore an imported file's text. */
  importText: (text: string) => SessionResult;
  /** Build a share link (may be too-large). */
  shareLink: () => ShareLinkResult;
  /** Copy the share link to the clipboard. True on success. */
  copyShareLink: (clipboard?: ClipboardLike) => Promise<boolean>;
  /** The compressed session payload (for the Clipboard tab). */
  sessionEncoded: () => string;
  copySessionPayload: (clipboard?: ClipboardLike) => Promise<boolean>;
  restoredFromUrl: boolean;
  urlError: SessionError | null;
  clearUrlError: () => void;
}

const AUTO_SAVE_MS = 800;

/** Copy text with an injectable clipboard (tests) and an execCommand fallback. */
export async function copyToClipboard(text: string, clipboard?: ClipboardLike): Promise<boolean> {
  const target =
    clipboard ??
    (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function"
      ? navigator.clipboard
      : undefined);
  if (target) {
    try {
      await target.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Session lifecycle for the playground: auto-save, explicit save/duplicate/
 * reset/restore, import/export, share links, and one-time restore from a share
 * URL. All heavy lifting is delegated to the pure `src/session` layer — this
 * hook only translates app state and orchestrates timing.
 */
export function useSession({ content, applyContent, autoSave = true }: UseSessionOptions): SessionController {
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(autoSave);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [restoredFromUrl, setRestoredFromUrl] = useState(false);
  const [urlError, setUrlError] = useState<SessionError | null>(null);

  const metaRef = useRef<SessionMeta | null>(null);
  const didRestoreRef = useRef(false);
  const lastSignatureRef = useRef<string | null>(null);
  const applyRef = useRef(applyContent);
  useEffect(() => {
    applyRef.current = applyContent;
  });

  const buildSessionNow = useCallback((now: number): Session => {
    const createdAt = metaRef.current?.createdAt ?? now;
    const modifiedAt = metaRef.current?.modifiedAt ?? now;
    return buildSession(content, createdAt, modifiedAt);
  }, [content]);

  const persist = useCallback(
    (target: SessionContent, now: number): Session => {
      const createdAt = metaRef.current?.createdAt ?? now;
      const session = buildSession(target, createdAt, now);
      metaRef.current = session.meta;
      lastSignatureRef.current = sessionContentSignature(target);
      storeSession(session);
      setSavedAt(now);
      return session;
    },
    [],
  );

  // Auto-save: debounced on every content change; never fires during a restore
  // because restoring replaces the content and reschedules the timer. Changes
  // that produce the same canonical content (e.g. only a timestamp moved) are
  // skipped so localStorage isn't rewritten for no reason.
  useEffect(() => {
    if (!autoSaveEnabled) return;
    const signature = sessionContentSignature(content);
    const timer = window.setTimeout(() => {
      if (signature === lastSignatureRef.current) return;
      persist(content, Date.now());
    }, AUTO_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [content, autoSaveEnabled, persist]);

  // One-time restore from ?session= (opening a shared link). Runs before the
  // first auto-save can overwrite anything meaningful, and before the browser
  // paints. No page reload.
  useEffect(() => {
    if (typeof window === "undefined" || didRestoreRef.current) return;
    didRestoreRef.current = true;
    const url = window.location.href;
    if (!hasSharePayload(url)) return;

    // Commit state from a timer callback (not synchronously in this mount
    // effect) so the restore cannot cascade renders out of the effect body.
    const timer = window.setTimeout(() => {
      const result = shareSessionFromUrl(url);
      if (result.ok) {
        applyRef.current(result.session.content);
        metaRef.current = result.session.meta;
        lastSignatureRef.current = sessionContentSignature(result.session.content);
        storeSession(result.session);
        setSavedAt(result.session.meta.modifiedAt);
        setRestoredFromUrl(true);
      } else {
        setUrlError(result.error);
      }
      try {
        window.history.replaceState(null, "", stripShareParam(url));
      } catch {
        // history API unavailable (rare) — session still restored
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const save = useCallback(() => persist(content, Date.now()), [persist, content]);

  const duplicate = useCallback((): Session => {
    const now = Date.now();
    metaRef.current = null; // start a fresh lineage
    return persist(content, now);
  }, [persist, content]);

  const resetWorkspace = useCallback(() => {
    clearStoredSession();
    metaRef.current = null;
    setSavedAt(null);
    applyRef.current(defaultSessionContent(DEFAULT_CODE));
  }, []);

  const restoreLast = useCallback((): boolean => {
    const session = loadStoredSession();
    if (!session) return false;
    applyRef.current(session.content);
    metaRef.current = session.meta;
    setSavedAt(session.meta.modifiedAt);
    storeSession(session);
    return true;
  }, []);

  const hasSaved = useCallback(() => hasStoredSession(), []);

  const snapshot = useCallback(() => buildSessionNow(Date.now()), [buildSessionNow]);

  const exportText = useCallback(() => serializeSession(buildSessionNow(Date.now())), [buildSessionNow]);

  const exportFileName = useCallback(() => {
    const stamp = metaRef.current?.createdAt ?? Date.now();
    return `codescope-session-${stamp}.codescope`;
  }, []);

  const importText = useCallback((text: string): SessionResult => {
    const result = deserializeSession(text);
    if (result.ok) {
      applyRef.current(result.session.content);
      metaRef.current = result.session.meta;
      storeSession(result.session);
      setSavedAt(result.session.meta.modifiedAt);
    }
    return result;
  }, []);

  const shareLink = useCallback(
    () => buildShareLink(buildSessionNow(Date.now())),
    [buildSessionNow],
  );

  const copyShareLink = useCallback(
    async (clipboard?: ClipboardLike): Promise<boolean> => {
      const link = shareLink();
      if (!link.ok) return false;
      return copyToClipboard(link.url, clipboard);
    },
    [shareLink],
  );

  const sessionEncoded = useCallback(
    () => compressSession(buildSessionNow(Date.now())),
    [buildSessionNow],
  );

  const copySessionPayload = useCallback(
    async (clipboard?: ClipboardLike): Promise<boolean> => copyToClipboard(sessionEncoded(), clipboard),
    [sessionEncoded],
  );

  const clearUrlError = useCallback(() => setUrlError(null), []);

  return {
    savedAt,
    autoSaveEnabled,
    setAutoSaveEnabled,
    snapshot,
    save,
    duplicate,
    resetWorkspace,
    restoreLast,
    hasSaved,
    exportText,
    exportFileName,
    importText,
    shareLink,
    copyShareLink,
    sessionEncoded,
    copySessionPayload,
    restoredFromUrl,
    urlError,
    clearUrlError,
  };
}
