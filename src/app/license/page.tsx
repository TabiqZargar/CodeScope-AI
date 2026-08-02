import { DocsShell } from "@/components/docs/docs-shell";

const LICENSE_TEXT = `MIT License

Copyright (c) 2026 TabiqZargar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export default function LicensePage() {
  return (
    <DocsShell
      title="License"
      description="CodeScope AI is released under the MIT License — free to use, modify, and distribute."
    >
      <div className="glass-panel p-6">
        <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-secondary">
          {LICENSE_TEXT}
        </pre>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface-glass p-5">
        <h2 className="text-sm font-semibold text-ink-primary">Third-party notices</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          CodeScope AI is built on open-source dependencies distributed under their own licenses,
          including Next.js, React, Monaco Editor, React Flow, Framer Motion, Babel, and Tailwind
          CSS. The bundled Coder Sans Mono font (v1.075) is MIT licensed. See each dependency for
          its full license text.
        </p>
      </div>
    </DocsShell>
  );
}
