"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";
import type { EditorProps, Monaco, OnMount } from "@monaco-editor/react";
import { FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

// Pin the Monaco build served to the browser so CDN releases can't break us.
// This module is only imported client-side (the editor is loaded with ssr:false).
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs",
  },
});

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-sky-400" />
    </div>
  ),
});

type EditorInstance = Parameters<OnMount>[0];

/** Dark theme tuned to the CodeScope palette. */
function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("codescope-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5c6a7d", fontStyle: "italic" },
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "6ee7b7" },
      { token: "number", foreground: "fbbf24" },
      { token: "type", foreground: "7dd3fc" },
      { token: "variable", foreground: "e2e8f0" },
      { token: "operator", foreground: "93c5fd" },
      { token: "delimiter", foreground: "64748b" },
      { token: "identifier", foreground: "e2e8f0" },
    ],
    colors: {
      "editor.background": "#0b0e14",
      "editor.foreground": "#d7dde7",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#3a4354",
      "editorLineNumber.activeForeground": "#94a3b8",
      "editorCursor.foreground": "#38bdf8",
      "editorGutter.background": "#0b0e14",
      "editorIndentGuide.background": "#ffffff08",
      "editorIndentGuide.activeBackground": "#ffffff1a",
      "editorWidget.background": "#12151d",
      "editorSuggestWidget.background": "#12151d",
      "editor.selectionBackground": "#38bdf833",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#ffffff1a",
      "scrollbarSlider.hoverBackground": "#ffffff2b",
      "scrollbarSlider.activeBackground": "#ffffff3d",
    },
  });
}

const EDITOR_OPTIONS: EditorProps["options"] = {
  fontSize: 14,
  lineHeight: 24,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: "none",
  padding: { top: 16, bottom: 16 },
  wordWrap: "on",
  automaticLayout: true,
  folding: false,
  glyphMargin: true,
  lineDecorationsWidth: 10,
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    alwaysConsumeMouseWheel: false,
  },
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  contextmenu: false,
  smoothScrolling: true,
  cursorSmoothCaretAnimation: "on",
  tabSize: 2,
  renderWhitespace: "none",
  fontFamily: "'Geist Mono', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace",
};

interface EditorPaneProps {
  initialCode: string;
  onChange: (value: string) => void;
  /** 1-based line to highlight, or null when no line is active. */
  activeLine: number | null;
  /** Lines with an enabled breakpoint (rose glyphs in the gutter). */
  breakpointLines: ReadonlySet<number>;
  /** Toggle the breakpoint at `line` (gutter click or F9). */
  onToggleBreakpoint: (line: number) => void;
  /** When true, the active line is decorated as a stopped breakpoint. */
  stoppedOnBreakpoint?: boolean;
  /** Reports the cursor line (for F9 toggling at the cursor). */
  onCursorLineChange?: (line: number) => void;
  /** Reports editor focus changes (F9 only toggles at the cursor when focused). */
  onFocusChange?: (focused: boolean) => void;
}

export function EditorPane({
  initialCode,
  onChange,
  activeLine,
  breakpointLines,
  onToggleBreakpoint,
  stoppedOnBreakpoint = false,
  onCursorLineChange,
  onFocusChange,
}: EditorPaneProps) {
  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<ReturnType<EditorInstance["createDecorationsCollection"]> | null>(
    null,
  );
  const breakpointLinesRef = useRef(breakpointLines);
  const onToggleBreakpointRef = useRef(onToggleBreakpoint);
  const onCursorLineChangeRef = useRef(onCursorLineChange);
  const onFocusChangeRef = useRef(onFocusChange);
  useEffect(() => {
    breakpointLinesRef.current = breakpointLines;
    onToggleBreakpointRef.current = onToggleBreakpoint;
    onCursorLineChangeRef.current = onCursorLineChange;
    onFocusChangeRef.current = onFocusChange;
  });

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const decorations = decorationsRef.current;
    if (!editor || !monaco || !decorations) return;

    if (activeLine == null || activeLine <= 0) {
      decorations.set([]);
      return;
    }

    decorations.set([
      {
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: stoppedOnBreakpoint
            ? "codescope-breakpoint-line"
            : "codescope-execution-line",
          linesDecorationsClassName:
            stoppedOnBreakpoint
              ? "codescope-breakpoint-gutter"
              : "codescope-execution-gutter",
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ]);

    editor.revealLineInCenterIfOutsideViewport(activeLine, monaco.editor.ScrollType.Smooth);
  }, [activeLine, stoppedOnBreakpoint]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    defineTheme(monaco);
    editor.updateOptions({ theme: "codescope-dark" });
    decorationsRef.current = editor.createDecorationsCollection();

    // Breakpoint glyphs live in a dedicated decorations collection so toggling
    // a breakpoint never touches the execution/stopped-line decoration.
    const glyphs = editor.createDecorationsCollection();
    const syncGlyphs = () => {
      const current = breakpointLinesRef.current;
      glyphs.set(
        [...current]
          .filter((line) => line > 0)
          .map((line) => ({
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: false,
              glyphMarginClassName: "codescope-breakpoint-glyph",
              glyphMarginHoverMessage: { value: "Breakpoint — F9 to toggle, right-click to manage" },
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            },
          })),
      );
    };
    syncGlyphs();
    editor.onDidChangeModel(() => syncGlyphs());

    editor.onMouseDown((event) => {
      if (event.target?.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
      const position = event.target.position;
      if (!position) return;
      event.event.preventDefault();
      onToggleBreakpointRef.current(position.lineNumber);
    });

    editor.onDidChangeCursorPosition((event) => {
      onCursorLineChangeRef.current?.(event.position.lineNumber);
    });
    editor.onDidFocusEditorWidget(() => onFocusChangeRef.current?.(true));
    editor.onDidBlurEditorWidget(() => onFocusChangeRef.current?.(false));
    onCursorLineChangeRef.current?.(editor.getPosition()?.lineNumber ?? 1);
    onFocusChangeRef.current?.(editor.hasTextFocus());
  };

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-medium text-zinc-200">main.js</span>
          {breakpointLines.size > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              {breakpointLines.size}
            </span>
          )}
        </div>
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          JavaScript
        </span>
      </div>
      <div className={cn("min-h-0 flex-1")}>
        <MonacoEditor
          height="100%"
          defaultLanguage="javascript"
          defaultValue={initialCode}
          onChange={(value) => onChange(value ?? "")}
          onMount={handleMount}
          options={EDITOR_OPTIONS}
        />
      </div>
    </Panel>
  );
}
