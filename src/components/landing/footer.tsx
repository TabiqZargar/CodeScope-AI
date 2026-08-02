import Link from "next/link";
import { CodeXml, Github } from "lucide-react";
import { APP_VERSION, GITHUB_URL } from "./constants";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface-glass/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
            <CodeXml className="h-3.5 w-3.5 text-canvas" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold text-ink-primary">CodeScope AI</span>
            <span className="mt-0.5 text-[11px] text-ink-muted">v{APP_VERSION}</span>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-ink-primary"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <Link href="/docs" className="transition-colors hover:text-ink-primary">
            Documentation
          </Link>
          <Link href="/license" className="transition-colors hover:text-ink-primary">
            License
          </Link>
          <span className="text-ink-disabled">MIT</span>
        </nav>
      </div>
    </footer>
  );
}
