import { cn } from "@/lib/utils";

interface BrandLogoMarkProps {
  className?: string;
}

/**
 * CodeScope AI brand mark: an `</>` bracket glyph with an ascending
 * step-line between the brackets, evoking both code and the execution trace.
 */
export function BrandLogoMark({ className }: BrandLogoMarkProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-[0_8px_24px_-8px_rgba(117,104,255,0.7)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 32 32"
        className="h-full w-full text-canvas"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11.5 8.5 5.5 16l6 7.5" />
        <path d="M20.5 8.5 26.5 16l-6 7.5" />
        <path d="M13.5 20.5v-4.5H18v-4.5h4.5" />
      </svg>
    </div>
  );
}
