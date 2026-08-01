import { CodeXml, Github } from "lucide-react";
import { APP_VERSION, DOCS_URL, GITHUB_URL } from "./constants";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-white/[0.02]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400/90 to-indigo-500/90">
            <CodeXml className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold text-white">CodeScope AI</span>
            <span className="mt-0.5 text-[11px] text-zinc-500">v{APP_VERSION}</span>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <a href={DOCS_URL} className="transition-colors hover:text-white">
            Documentation
          </a>
          <a href={GITHUB_URL} className="transition-colors hover:text-white">
            License
          </a>
          <span className="text-zinc-600">MIT</span>
        </nav>
      </div>
    </footer>
  );
}
