import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CodeXml } from "lucide-react";
import { Footer } from "@/components/landing/footer";

export function DocsShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="font-coder-sans flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg-primary/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-[0_8px_24px_-8px_rgba(117,104,255,0.7)]">
              <CodeXml className="h-4 w-4 text-canvas" strokeWidth={2.2} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-ink-primary">CodeScope AI</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/playground" className="btn-primary hidden rounded-lg px-3.5 py-2 text-sm font-semibold sm:block">
              Open Playground
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink-primary md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted md:text-base">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
