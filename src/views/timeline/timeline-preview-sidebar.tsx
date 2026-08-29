import { getAgentColor } from "@/domain/agent/colors";
import { getLanguageDisplayLine } from "@/domain/language/display";
import { hasLexicalBoundaryAfter } from "@/domain/language/transliteration-format";
import { bgBounds, effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { Scroll } from "@/ui/scroll";
import { stripSplitCharacter } from "@/utils/split-character";
import { splitIntoWords } from "@/utils/sync-helpers";
import { getTimingState } from "@/views/timeline/timeline-preview-sidebar-activity";
import { useRef } from "react";

// -- Helpers ------------------------------------------------------------------

function getAgentAlignment(agentId: string): "left" | "center" | "right" {
  const match = agentId.match(/^v(\d+)$/);
  if (!match) return "center";
  const num = Number.parseInt(match[1], 10);
  if (num >= 1000) return "center";
  return num % 2 === 1 ? "left" : "right";
}

// -- Components ---------------------------------------------------------------

const WordWithProgress: React.FC<{
  text: string;
  begin: number;
  end: number;
  lineIndex: number;
}> = ({ text, begin, end, lineIndex }) => (
  <span className="relative inline-block whitespace-pre">
    <span className="text-composer-text-muted">{text}</span>
    <span
      className="absolute inset-0 text-composer-accent-text"
      data-word-begin={begin}
      data-word-end={end}
      data-line-idx={lineIndex}
      style={{ clipPath: "inset(0 100% 0 0)" }}
    >
      {text}
    </span>
  </span>
);

const BgWordsRow: React.FC<{
  backgroundWords: NonNullable<LyricLine["backgroundWords"]>;
  lineIndex: number;
  alignmentClass: string;
}> = ({ backgroundWords, lineIndex, alignmentClass }) => (
  <div className={`flex flex-wrap items-center gap-y-0.5 text-xs font-medium mt-0.5 ${alignmentClass}`}>
    {backgroundWords.map((bgWord) => (
      <WordWithProgress
        key={`bg-${bgWord.begin}-${bgWord.text}`}
        text={bgWord.text}
        begin={bgWord.begin}
        end={bgWord.end}
        lineIndex={lineIndex}
      />
    ))}
  </div>
);

const TransliterationRow: React.FC<{
  text?: string;
  words?: WordTiming[];
  wordTexts?: string[];
  timing: { begin: number; end: number } | null;
  lineIndex: number;
  alignmentClass: string;
  background?: boolean;
}> = ({ text, words, wordTexts, timing, lineIndex, alignmentClass, background = false }) => {
  const content = text?.trim();
  if (!content) return null;

  const timedWords = words?.length
    ? words.map((word, index) => {
        const displayText = wordTexts?.[index] ?? word.transliteration ?? word.text;
        const addSpace = hasLexicalBoundaryAfter(words, index) && !displayText.endsWith(" ");
        return (
          <WordWithProgress
            key={`${word.begin}-${word.end}-${word.text}`}
            text={addSpace ? `${displayText} ` : displayText}
            begin={word.begin}
            end={word.end}
            lineIndex={lineIndex}
          />
        );
      })
    : null;

  return (
    <div
      data-preview-transliteration={background ? "background" : "main"}
      className={`flex flex-wrap ${alignmentClass} mt-0.5 ${background ? "text-[10px]" : "text-xs"}`}
    >
      {timedWords ??
        (timing ? (
          <WordWithProgress text={content} begin={timing.begin} end={timing.end} lineIndex={lineIndex} />
        ) : (
          <span className="text-composer-text-muted">{content}</span>
        ))}
    </div>
  );
};

const MiniPreviewLine: React.FC<{
  line: LyricLine;
  lineIndex: number;
  granularity: "line" | "word";
}> = ({ line, lineIndex, granularity }) => {
  const timing = effectiveBounds(line);
  const alignment = getAgentAlignment(line.agentId);
  const alignmentClass =
    alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";
  const agentColor = getAgentColor(line.agentId);
  const textAlignClass = alignment === "left" ? "text-left" : alignment === "right" ? "text-right" : "text-center";
  const transliteratedLine = getLanguageDisplayLine(line, "transliteration");

  const AgentDotLeft = (
    <span
      className="inline-block size-1.5 mr-2 rounded-full"
      style={{ backgroundColor: agentColor, verticalAlign: "0.1em" }}
    />
  );
  const AgentDotRight = (
    <span
      className="inline-block size-1.5 ml-2 rounded-full"
      style={{ backgroundColor: agentColor, verticalAlign: "0.1em" }}
    />
  );

  const words = line.words ?? [];
  const bgWords = line.backgroundWords?.length ? (
    <BgWordsRow backgroundWords={line.backgroundWords} lineIndex={lineIndex} alignmentClass={alignmentClass} />
  ) : null;
  const transliteration = (
    <TransliterationRow
      text={line.transliteration?.text ? transliteratedLine.text : undefined}
      words={granularity === "word" ? transliteratedLine.words : undefined}
      wordTexts={transliteratedLine.wordTexts}
      timing={timing}
      lineIndex={lineIndex}
      alignmentClass={alignmentClass}
    />
  );
  const backgroundTransliteration = (
    <TransliterationRow
      text={line.transliteration?.backgroundText ? transliteratedLine.backgroundText : undefined}
      words={granularity === "word" ? transliteratedLine.backgroundWords : undefined}
      wordTexts={transliteratedLine.backgroundWordTexts}
      timing={bgBounds(line) ?? timing}
      lineIndex={lineIndex}
      alignmentClass={alignmentClass}
      background
    />
  );

  if (granularity === "line") {
    return (
      <div
        className={`py-1.5 px-3 ${textAlignClass}`}
        style={{ opacity: 0.3 }}
        data-line-begin={timing?.begin ?? 0}
        data-line-end={timing?.end ?? 0}
        data-line-idx={lineIndex}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {alignment === "left" && AgentDotLeft}
          <span className="relative block truncate">
            <span className="text-composer-text-muted">{stripSplitCharacter(line.text)}</span>
            <span
              className="absolute inset-0 text-composer-accent-text truncate"
              data-word-begin={timing?.begin ?? 0}
              data-word-end={timing?.end ?? 0}
              data-line-idx={lineIndex}
              style={{ clipPath: "inset(0 100% 0 0)" }}
            >
              {stripSplitCharacter(line.text)}
            </span>
          </span>
          {alignment === "right" && AgentDotRight}
        </div>
        {transliteration}
        {bgWords}
        {backgroundTransliteration}
      </div>
    );
  }

  return (
    <div
      className={`py-1.5 px-3 ${textAlignClass}`}
      style={{ opacity: 0.3 }}
      data-line-begin={timing?.begin ?? 0}
      data-line-end={timing?.end ?? 0}
      data-line-idx={lineIndex}
    >
      <div className={`flex flex-wrap items-center text-sm font-medium ${alignmentClass}`}>
        {alignment === "left" && AgentDotLeft}
        {words.length > 0
          ? words.map((word) => (
              <WordWithProgress
                key={`${word.begin}-${word.text}`}
                text={word.text}
                begin={word.begin}
                end={word.end}
                lineIndex={lineIndex}
              />
            ))
          : splitIntoWords(line.text).map((word, idx) => (
              <span key={`${idx}-${word}`} className="text-composer-text-muted">
                {word}{" "}
              </span>
            ))}
        {alignment === "right" && AgentDotRight}
      </div>
      {transliteration}
      {bgWords}
      {backgroundTransliteration}
    </div>
  );
};

const TimelinePreviewSidebar: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const granularity = useProjectStore((s) => s.granularity);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrolledLineRef = useRef<number>(-1);

  // Queries DOM directly on each frame for reliability
  useFrameLoop(() => {
    const container = containerRef.current;
    if (!container) return;

    const audioEl = useAudioStore.getState().audioElement;
    const currentTime = audioEl?.currentTime ?? useAudioStore.getState().currentTime;
    let currentLineIdx = -1;

    const wordEls = container.querySelectorAll<HTMLElement>("[data-word-begin]");
    for (const el of wordEls) {
      const begin = Number.parseFloat(el.dataset.wordBegin ?? "0");
      const end = Number.parseFloat(el.dataset.wordEnd ?? "0");
      const lineIdx = Number.parseInt(el.dataset.lineIdx ?? "-1", 10);

      const { isActive, progress } = getTimingState(begin, end, currentTime);
      el.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;

      if (isActive && lineIdx > currentLineIdx) {
        currentLineIdx = lineIdx;
      }
    }

    const lineEls = container.querySelectorAll<HTMLElement>("[data-line-begin]");
    for (const el of lineEls) {
      const begin = Number.parseFloat(el.dataset.lineBegin ?? "0");
      const end = Number.parseFloat(el.dataset.lineEnd ?? "0");
      const { isActive, isComplete } = getTimingState(begin, end, currentTime);
      const style = el.style;

      if (isActive) {
        style.opacity = "1";
      } else if (isComplete) {
        style.opacity = "0.6";
      } else {
        style.opacity = "0.3";
      }
    }

    // Auto-scroll to current line
    if (currentLineIdx !== -1 && currentLineIdx !== lastScrolledLineRef.current) {
      for (const el of lineEls) {
        const idx = Number.parseInt(el.dataset.lineIdx ?? "-1", 10);
        if (idx === currentLineIdx) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          lastScrolledLineRef.current = currentLineIdx;
          break;
        }
      }
    }
  }, "timeline-preview-sidebar");

  const hasSyncedContent = lines.some((line) => effectiveBounds(line) !== null);

  if (lines.length === 0 || !hasSyncedContent) {
    return (
      <div className="w-64 border-l border-composer-border bg-composer-bg-dark flex items-center justify-center">
        <span className="text-sm text-composer-text-muted">No synced content</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-64 border-l border-composer-border bg-composer-bg-dark flex flex-col overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-composer-border text-xs font-medium text-composer-text-muted">
        Preview
      </div>
      <Scroll className="flex-1 py-2">
        {lines.map((line, index) => (
          <MiniPreviewLine key={line.id} line={line} lineIndex={index} granularity={granularity} />
        ))}
      </Scroll>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { TimelinePreviewSidebar };
