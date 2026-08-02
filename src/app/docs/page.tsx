import { DocsShell } from "@/components/docs/docs-shell";
import {
  Bookmark,
  BookOpen,
  Database,
  Flag,
  GitGraph,
  Layers,
  ListOrdered,
  Play,
  ScanEye,
  Share2,
  Sparkles,
  Terminal,
} from "lucide-react";

const SECTIONS = [
  { href: "#quickstart", label: "Quick start", icon: Play },
  { href: "#editor", label: "The editor", icon: BookOpen },
  { href: "#timeline", label: "Timeline & playback", icon: ListOrdered },
  { href: "#panels", label: "Inspector panels", icon: Layers },
  { href: "#graph", label: "Execution graph", icon: GitGraph },
  { href: "#breakpoints", label: "Breakpoints & bookmarks", icon: Flag },
  { href: "#ai", label: "AI explanations", icon: Sparkles },
  { href: "#gallery", label: "Example gallery", icon: BookOpen },
  { href: "#sessions", label: "Sessions & sharing", icon: Share2 },
  { href: "#privacy", label: "Safety & privacy", icon: ScanEye },
];

function Toc() {
  return (
    <nav className="glass-panel p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-ink-disabled">On this page</h2>
      <ul className="mt-3 space-y-0.5">
        {SECTIONS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <a
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-primary"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <div className="flex items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-primary to-secondary" />
        <h2 className="text-xl font-semibold tracking-tight text-ink-primary">{title}</h2>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-glass p-5">
      <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}

function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default function DocsPage() {
  return (
    <DocsShell
      title="Documentation"
      description="How CodeScope AI traces JavaScript execution — the editor, timeline, inspector panels, execution graph, AI explanations, sessions, and more."
    >
      <Toc />

      <Section id="quickstart" title="Quick start">
        <Steps
          steps={[
            "Open the playground and write a program in the editor, or pick one from the example gallery.",
            "Press Run (or load an example) to execute the code against the interpreter.",
            "Step forward and backward through the immutable snapshot timeline.",
            "Watch variables, heap, call stack, and console update on every step.",
            "Ask the AI to explain any snapshot, or export the workspace as a shareable session.",
          ]}
        />
      </Section>

      <Section id="editor" title="The editor">
        <Card title="Write or paste a program">
          <p>
            The editor is a full Monaco instance with JavaScript syntax highlighting. The current
            execution line is highlighted as you step, and you can click the gutter to toggle
            breakpoints. Code runs only in the sandboxed interpreter — never through{" "}
            <code className="rounded bg-surface-hover px-1 text-[12px] text-ink-secondary">eval</code>{" "}
            or the VM.
          </p>
        </Card>
      </Section>

      <Section id="timeline" title="Timeline & playback">
        <Card title="Immutable snapshots">
          <p>
            Every executed statement produces one immutable snapshot: the state after that step. You
            can scrub anywhere in the trace without re-running, because nothing is mutated — each
            step is a full, independent view.
          </p>
          <p>
            Use the playback controls to play, pause, step, or jump. The speed selector controls
            auto-playback pace, the timeline search jumps to statements containing a query, and the
            mini-map gives an overview of the whole run. Diffing marks exactly what changed between
            consecutive steps.
          </p>
        </Card>
      </Section>

      <Section id="panels" title="Inspector panels">
        <div className="space-y-4">
          <Card title="Variables">
            <p>
              Every binding in scope, with values formatted to their runtime type. Changed bindings
              are highlighted on the step that modified them; newly added ones are marked too.
            </p>
          </Card>
          <Card title="Heap">
            <p>
              Objects and arrays live here so reference semantics and aliasing become visible. New
              allocations and mutations are flagged on the relevant step.
            </p>
          </Card>
          <Card title="Call stack">
            <p>
              Frames push as functions are called and pop when they return. Each frame shows its
              parameters and locals; the active frame is highlighted.
            </p>
          </Card>
          <Card title="Console & watch">
            <p>
              <code className="rounded bg-surface-hover px-1 text-[12px] text-ink-secondary">console.log</code>{" "}
              output appears in the terminal-styled console. The watch panel tracks expressions of
              your choice across the entire run.
            </p>
          </Card>
        </div>
      </Section>

      <Section id="graph" title="Execution graph">
        <Card title="Control-flow at a glance">
          <p>
            The graph view renders the run as a navigable control-flow graph: branch nodes for
            conditionals, back-edges for loops, and call/return edges for functions. The path taken
            so far is highlighted, and you can click any node to jump to that snapshot. Use the
            filters to hide or show specific node kinds.
          </p>
        </Card>
      </Section>

      <Section id="breakpoints" title="Breakpoints & bookmarks">
        <Card title="Pause where it matters">
          <p>
            Click the editor gutter to toggle a breakpoint on a line. Playback stops at enabled
            breakpoints so you can step manually. Timeline nodes can also be bookmarked for quick
            reference during a long run.
          </p>
        </Card>
      </Section>

      <Section id="ai" title="AI explanations">
        <Card title="Explain any snapshot">
          <p>
            Select a snapshot and ask for an explanation. The AI returns a summary of what just
            happened, the concept behind it, and what happens next — streamed in real time when the
            provider supports streaming. Confidence is reported per explanation.
          </p>
        </Card>
        <Card title="Providers">
          <p>
            Three providers are supported:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <span className="text-ink-secondary">Local (offline) — default.</span> Deterministic
              explanations generated in-process from the snapshot. No network, no API key.
            </li>
            <li>
              <span className="text-ink-secondary">OpenAI</span> — set{" "}
              <code className="rounded bg-surface-hover px-1 text-[12px] text-ink-secondary">OPENAI_API_KEY</code>{" "}
              server-side.
            </li>
            <li>
              <span className="text-ink-secondary">Google Gemini</span> — set{" "}
              <code className="rounded bg-surface-hover px-1 text-[12px] text-ink-secondary">GEMINI_API_KEY</code>{" "}
              server-side.
            </li>
          </ul>
          <p>
            Keys are resolved on the server and never exposed to the browser. Choose a provider and
            model in the AI settings dialog. With no key configured, CodeScope falls back to the
            local provider automatically.
          </p>
        </Card>
      </Section>

      <Section id="gallery" title="Example gallery">
        <Card title="Start from a curated program">
          <p>
            The gallery ships pre-verified examples across categories and difficulty levels. Filter
            by category, difficulty, or tag; favorite and revisit examples; and load any of them
            straight into the playground, ready to step through.
          </p>
        </Card>
      </Section>

      <Section id="sessions" title="Sessions & sharing">
        <Card title="Workspace, serialized">
          <p>
            Your workspace — code, breakpoints, watches, view, speed, and preferences — can be
            exported as a <code className="rounded bg-surface-hover px-1 text-[12px] text-ink-secondary">.codescope</code>{" "}
            file or a compressed share link, then restored anywhere. Auto-save keeps the last
            session so you can pick up where you left off. Invalid or foreign files are rejected on
            import.
          </p>
        </Card>
      </Section>

      <Section id="privacy" title="Safety & privacy">
        <Card title="Your code stays local">
          <p>
            Execution happens entirely in the browser. No code, breakpoints, or UI state is sent
            anywhere. The only network calls are the ones you opt into by configuring an AI
            provider, and the explanation prompts contain only minimal execution context — never
            your full source code.
          </p>
        </Card>
        <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-secondary" /> No eval, no Function
          </span>
          <span className="flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-secondary" /> Console-only output
          </span>
          <span className="flex items-center gap-1.5">
            <Bookmark className="h-3.5 w-3.5 text-secondary" /> Immutable snapshots
          </span>
        </div>
      </Section>
    </DocsShell>
  );
}
