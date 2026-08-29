import { hasLexicalBoundaryAfter } from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import type { FC } from "react";

const WordWithProgress: FC<{
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

const BgWordsRow: FC<{
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

const TransliterationRow: FC<{
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

export { BgWordsRow, TransliterationRow, WordWithProgress };
