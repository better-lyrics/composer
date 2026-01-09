import { useAudioStore } from "@/stores/audio";
import { getAgentColor, useProjectStore } from "@/stores/project";
import type { LyricLine } from "@/stores/project";
import { Button } from "@/ui/button";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";

// -- Constants ----------------------------------------------------------------

function getAgentAlignment(agentId: string): "left" | "center" | "right" {
  const match = agentId.match(/^v(\d+)$/);
  if (!match) return "center";

  const num = Number.parseInt(match[1], 10);
  // High numbers (v1000+) are centered (harmony/chorus)
  if (num >= 1000) return "center";
  // Low numbers alternate: odd=left, even=right
  return num % 2 === 1 ? "left" : "right";
}

// -- Helpers ------------------------------------------------------------------

function getLineTiming(line: LyricLine): { begin: number; end: number } | null {
  // Deduce line timing from words if available
  if (line.words?.length) {
    const firstWord = line.words[0];
    const lastWord = line.words[line.words.length - 1];
    return { begin: firstWord.begin, end: lastWord.end };
  }
  // Fall back to explicit line timing
  if (line.begin !== undefined && line.end !== undefined) {
    return { begin: line.begin, end: line.end };
  }
  return null;
}

interface ActivePosition {
  lineIndex: number;
  wordIndex: number;
  progress: number;
}

function findActivePositions(lines: LyricLine[], currentTime: number, granularity: "line" | "word"): ActivePosition[] {
  const positions: ActivePosition[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    if (granularity === "line") {
      const timing = getLineTiming(line);
      if (timing && currentTime >= timing.begin) {
        // Handle case where end === begin (last synced word not closed yet)
        const isOpen = timing.end === timing.begin;
        if (isOpen || currentTime < timing.end) {
          const duration = timing.end - timing.begin;
          const progress = duration > 0 ? (currentTime - timing.begin) / duration : 0;
          positions.push({ lineIndex: lineIdx, wordIndex: -1, progress });
        }
      }
    } else {
      if (line.words?.length) {
        for (let wordIdx = 0; wordIdx < line.words.length; wordIdx++) {
          const word = line.words[wordIdx];
          if (currentTime >= word.begin) {
            // Handle case where end === begin (word not closed yet)
            const isOpen = word.end === word.begin;
            if (isOpen || currentTime < word.end) {
              const duration = word.end - word.begin;
              const progress = duration > 0 ? (currentTime - word.begin) / duration : 0;
              positions.push({ lineIndex: lineIdx, wordIndex: wordIdx, progress });
            }
          }
        }
      }
    }
  }

  return positions;
}

function isWordCompleted(word: { begin: number; end: number }, currentTime: number): boolean {
  // Word must have actual duration (end > begin) and time must have passed its end
  return word.end > word.begin && currentTime >= word.end;
}

function isLineCompleted(line: LyricLine, currentTime: number): boolean {
  const timing = getLineTiming(line);
  return timing ? currentTime >= timing.end : false;
}

// -- Components ---------------------------------------------------------------

const PreviewLine: React.FC<{
  line: LyricLine;
  lineIndex: number;
  activePositions: ActivePosition[];
  currentTime: number;
  granularity: "line" | "word";
}> = ({ line, lineIndex, activePositions, currentTime, granularity }) => {
  const lineRef = useRef<HTMLDivElement>(null);

  const linePosition = activePositions.find((p) => p.lineIndex === lineIndex && p.wordIndex === -1);
  const isLineCurrent =
    granularity === "line" ? !!linePosition : activePositions.some((p) => p.lineIndex === lineIndex);
  const lineCompleted = isLineCompleted(line, currentTime);

  useEffect(() => {
    if (isLineCurrent && lineRef.current) {
      lineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isLineCurrent]);

  const alignment = getAgentAlignment(line.agentId);
  const alignmentClass =
    alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";
  const agentColor = getAgentColor(line.agentId);

  const textAlignClass = alignment === "left" ? "text-left" : alignment === "right" ? "text-right" : "text-center";

  if (granularity === "line") {
    const progress = linePosition ? linePosition.progress : lineCompleted ? 1 : 0;

    return (
      <div
        ref={lineRef}
        className={`py-3 px-6 transition-opacity ${textAlignClass} ${
          isLineCurrent ? "opacity-100" : lineCompleted ? "opacity-60" : "opacity-30"
        }`}
      >
        <div className="inline-flex items-center gap-3 text-2xl font-medium">
          {alignment === "left" && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agentColor }} />
          )}
          <span className="relative inline-block">
            <span className="text-composer-text-muted">{line.text}</span>
            <span
              className="absolute inset-0 overflow-hidden text-composer-accent-text"
              style={{ width: `${progress * 100}%` }}
            >
              {line.text}
            </span>
          </span>
          {alignment === "right" && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agentColor }} />
          )}
        </div>
        {line.backgroundText && line.backgroundWords?.length && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium mt-1 justify-center">
            {line.backgroundWords.map((bgWord, bgIdx) => {
              const bgCompleted = isWordCompleted(bgWord, currentTime);
              const bgIsActive =
                currentTime >= bgWord.begin && (bgWord.end === bgWord.begin || currentTime < bgWord.end);
              const bgDuration = bgWord.end - bgWord.begin;
              const bgProgress = bgIsActive
                ? bgDuration > 0
                  ? (currentTime - bgWord.begin) / bgDuration
                  : 0
                : bgCompleted
                  ? 1
                  : 0;

              return (
                <span key={`${lineIndex}-bg-${bgWord.text}-${bgIdx}`} className="relative inline-block">
                  <span className="text-composer-text-muted">{bgWord.text}</span>
                  <span
                    className="absolute inset-0 overflow-hidden text-composer-accent-text"
                    style={{ width: `${bgProgress * 100}%` }}
                  >
                    {bgWord.text}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Word-level rendering
  const words = line.words ?? [];

  return (
    <div
      ref={lineRef}
      className={`py-3 px-6 transition-opacity ${textAlignClass} ${
        isLineCurrent ? "opacity-100" : lineCompleted ? "opacity-60" : "opacity-30"
      }`}
    >
      <div className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-medium ${alignmentClass}`}>
        {alignment === "left" && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agentColor }} />
        )}
        {words.length > 0
          ? words.map((word, wordIdx) => {
              const wordCompleted = isWordCompleted(word, currentTime);
              const wordPosition = activePositions.find((p) => p.lineIndex === lineIndex && p.wordIndex === wordIdx);
              const isWordCurrent = !!wordPosition;
              const progress = isWordCurrent ? wordPosition.progress : wordCompleted ? 1 : 0;

              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: word order is fixed
                <span key={`${lineIndex}-${wordIdx}`} className="relative inline-block">
                  <span className="text-composer-text-muted">{word.text}</span>
                  <span
                    className="absolute inset-0 overflow-hidden text-composer-accent-text"
                    style={{ width: `${progress * 100}%` }}
                  >
                    {word.text}
                  </span>
                </span>
              );
            })
          : // Unsynced line - show as faded text
            line.text
              .split(/\s+/)
              .map((word, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: word order is fixed
                <span key={`${lineIndex}-${idx}`} className="text-composer-text-muted">
                  {word}
                </span>
              ))}
        {alignment === "right" && (
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agentColor }} />
        )}
      </div>
      {line.backgroundText && line.backgroundWords?.length && (
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium mt-1 ${alignmentClass}`}>
          {line.backgroundWords.map((bgWord, bgIdx) => {
            const bgCompleted = isWordCompleted(bgWord, currentTime);
            const bgIsActive = currentTime >= bgWord.begin && (bgWord.end === bgWord.begin || currentTime < bgWord.end);
            const bgDuration = bgWord.end - bgWord.begin;
            const bgProgress = bgIsActive
              ? bgDuration > 0
                ? (currentTime - bgWord.begin) / bgDuration
                : 0
              : bgCompleted
                ? 1
                : 0;

            return (
              <span key={`${lineIndex}-bg-${bgWord.text}-${bgIdx}`} className="relative inline-block">
                <span className="text-composer-text-muted">{bgWord.text}</span>
                <span
                  className="absolute inset-0 overflow-hidden text-composer-accent-text"
                  style={{ width: `${bgProgress * 100}%` }}
                >
                  {bgWord.text}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
    <p className="text-lg text-composer-text-secondary">{message}</p>
    <p className="text-sm text-composer-text-muted">{hint}</p>
  </div>
);

const PreviewPanel: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const granularity = useProjectStore((s) => s.granularity);
  const source = useAudioStore((s) => s.source);
  const currentTime = useAudioStore((s) => s.currentTime);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

  const activePositions = useMemo(
    () => findActivePositions(lines, currentTime, granularity),
    [lines, currentTime, granularity],
  );

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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
        <h2 className="text-lg font-medium">Preview</h2>
        <Button variant="primary" hasIcon onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <IconPlayerPauseFilled className="w-4 h-4" /> : <IconPlayerPlayFilled className="w-4 h-4" />}
          {isPlaying ? "Pause" : "Play"}
        </Button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-y-auto py-8">
        <div className="max-w-3xl mx-auto">
          {lines.map((line, index) => (
            <PreviewLine
              key={line.id}
              line={line}
              lineIndex={index}
              activePositions={activePositions}
              currentTime={currentTime}
              granularity={granularity}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { PreviewPanel };
