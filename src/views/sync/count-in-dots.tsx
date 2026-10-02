import { useFrameLoop } from "@/hooks/use-frame-loop";
import { holdFrames } from "@/lib/frame-loop";
import { useSyncCountInStore } from "@/stores/sync-count-in";
import { useEffect, useRef } from "react";

// -- Constants ----------------------------------------------------------------

const MAX_DOTS = 6;

// -- Helpers ------------------------------------------------------------------

function litDots(elapsedMs: number, totalMs: number, dotCount: number): number {
  if (totalMs <= 0) return dotCount;
  return Math.min(dotCount, Math.floor((elapsedMs / totalMs) * dotCount) + 1);
}

// -- Components ---------------------------------------------------------------

const CountInDots: React.FC = () => {
  const startedAt = useSyncCountInStore((s) => s.startedAt);
  const endsAt = useSyncCountInStore((s) => s.endsAt);
  const seconds = useSyncCountInStore((s) => s.seconds);
  const containerRef = useRef<HTMLSpanElement>(null);
  const counting = startedAt !== null && endsAt !== null;
  const dotCount = Math.min(seconds, MAX_DOTS);

  useEffect(() => (counting ? holdFrames("count-in dots") : undefined), [counting]);

  useFrameLoop(
    (now) => {
      if (startedAt === null || endsAt === null || !containerRef.current) return;
      const lit = litDots(now - startedAt, endsAt - startedAt, dotCount);
      containerRef.current.querySelectorAll("[data-count-in-dot]").forEach((dot, index) => {
        dot.toggleAttribute("data-on", index < lit);
      });
    },
    "count-in dots",
    counting,
  );

  if (!counting) return null;
  return (
    <span ref={containerRef} data-count-in-dots="" aria-hidden="true" className="flex h-4.5 items-center gap-3">
      {Array.from({ length: dotCount }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional and never reorder
          key={index}
          data-count-in-dot=""
          className="size-3 rounded-full bg-composer-bg-elevated transition-[background-color,scale] duration-200 data-on:bg-composer-text motion-safe:data-on:scale-115"
        />
      ))}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { CountInDots };
