import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { PreviewLine } from "@/views/preview/preview-line";
import { getLineTiming } from "@/views/timeline/utils";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";

// -- Hooks --------------------------------------------------------------------

interface CachedWord {
  el: HTMLElement;
  begin: number;
  end: number;
  duration: number;
  lineIdx: number;
}

interface CachedLine {
  el: HTMLElement;
  begin: number;
  end: number;
}

function usePreviewAnimation(
  containerRef: React.RefObject<HTMLDivElement | null>,
  isActive: boolean,
  linesVersion: number,
) {
  const rafRef = useRef<number | null>(null);
  const lastScrolledLineRef = useRef<number>(-1);
  const cachedWordsRef = useRef<CachedWord[]>([]);
  const cachedLinesRef = useRef<CachedLine[]>([]);
  const lineElsRef = useRef<Map<number, HTMLElement>>(new Map());

  // Cache element references when lines change
  // biome-ignore lint/correctness/useExhaustiveDependencies: linesVersion triggers recache intentionally
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Small delay to ensure React has rendered
    const timeoutId = setTimeout(() => {
      const wordEls = container.querySelectorAll<HTMLElement>("[data-word-begin]");
      cachedWordsRef.current = Array.from(wordEls).map((el) => ({
        el,
        begin: Number.parseFloat(el.dataset.wordBegin ?? "0"),
        end: Number.parseFloat(el.dataset.wordEnd ?? "0"),
        duration: Number.parseFloat(el.dataset.wordEnd ?? "0") - Number.parseFloat(el.dataset.wordBegin ?? "0"),
        lineIdx: Number.parseInt(el.dataset.lineIdx ?? "-1", 10),
      }));

      const lineEls = container.querySelectorAll<HTMLElement>("[data-line-begin]");
      cachedLinesRef.current = Array.from(lineEls).map((el) => ({
        el,
        begin: Number.parseFloat(el.dataset.lineBegin ?? "0"),
        end: Number.parseFloat(el.dataset.lineEnd ?? "0"),
      }));

      lineElsRef.current.clear();
      for (const el of lineEls) {
        const idx = Number.parseInt(el.dataset.lineIdx ?? "-1", 10);
        if (idx >= 0) lineElsRef.current.set(idx, el);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [linesVersion, containerRef]);

  useEffect(() => {
    if (!isActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const update = () => {
      // Read directly from audio element for smooth 60fps updates (store only updates ~4x/sec)
      const audioEl = useAudioStore.getState().audioElement;
      const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
      let currentLineIdx = -1;

      // Update word progress using cached refs
      for (const word of cachedWordsRef.current) {
        const isOpen = word.end === word.begin;
        const isWordActive = currentTime >= word.begin && (isOpen || currentTime < word.end);
        const isComplete = word.end > word.begin && currentTime >= word.end;

        let progress = 0;
        if (isWordActive && word.duration > 0) {
          progress = (currentTime - word.begin) / word.duration;
        } else if (isComplete) {
          progress = 1;
        }

        word.el.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;

        if (isWordActive && word.lineIdx > currentLineIdx) {
          currentLineIdx = word.lineIdx;
        }
      }

      // Update line opacities using cached refs
      for (const line of cachedLinesRef.current) {
        const isComplete = line.end > line.begin && currentTime >= line.end;
        const isLineActive = currentTime >= line.begin && (line.end === line.begin || currentTime < line.end);

        if (isLineActive) {
          line.el.style.opacity = "1";
        } else if (isComplete) {
          line.el.style.opacity = "0.6";
        } else {
          line.el.style.opacity = "0.3";
        }
      }

      // Scroll to current line
      if (currentLineIdx !== -1 && currentLineIdx !== lastScrolledLineRef.current) {
        const lineEl = lineElsRef.current.get(currentLineIdx);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: "smooth", block: "center" });
          lastScrolledLineRef.current = currentLineIdx;
        }
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive]);
}

// -- Components ---------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const PreviewPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const granularity = useProjectStore((s) => s.granularity);
  const activeTab = useProjectStore((s) => s.activeTab);
  const source = useAudioStore((s) => s.source);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const containerRef = useRef<HTMLDivElement>(null);
  const versionRef = useRef(0);
  const prevLinesRef = useRef(lines);
  const prevGranularityRef = useRef(granularity);

  // Increment version when lines or granularity change
  if (lines !== prevLinesRef.current || granularity !== prevGranularityRef.current) {
    versionRef.current++;
    prevLinesRef.current = lines;
    prevGranularityRef.current = granularity;
  }

  const isActive = activeTab === "preview";
  usePreviewAnimation(containerRef, isActive, versionRef.current);

  const hasSyncedContent = useMemo(() => {
    return lines.some((line) => getLineTiming(line) !== null);
  }, [lines]);

  if (!source) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No lyrics to preview" hint="Add lyrics in the Edit tab first" />
      </div>
    );
  }

  if (!hasSyncedContent) {
    return (
      <div className="flex flex-col flex-1 p-4">
        <EmptyState message="No synced content" hint="Sync lyrics in the Sync tab first" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden select-none">
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <h2 className="text-lg font-medium">Preview</h2>
        <Button variant="primary" hasIcon onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <IconPlayerPauseFilled className="w-4 h-4" /> : <IconPlayerPlayFilled className="w-4 h-4" />}
          {isPlaying ? "Pause" : "Play"}
        </Button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto py-8">
        <div className="max-w-3xl mx-auto">
          {lines.map((line, index) => (
            <PreviewLine key={line.id} line={line} lineIndex={index} granularity={granularity} />
          ))}
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { PreviewPanel };
