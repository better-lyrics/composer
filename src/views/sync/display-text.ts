import { alignTransliterationToWords } from "@/domain/language/align";
import type { TransliterationSegment } from "@/domain/language/model";
import { normalizeTransliterationForEditing } from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

type SyncTextVariant = "original" | "transliteration";

interface SyncDisplayLine {
  text: string;
  backgroundText?: string;
  words?: WordTiming[];
  backgroundWords?: WordTiming[];
  wordTexts?: string[];
  backgroundWordTexts?: string[];
}

function sourceSlots(text: string): WordTiming[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  return parts.map((part, index) => ({
    text: trailingSpace[index] ? `${part} ` : part,
    begin: index,
    end: index + 1,
  }));
}

function displayTrackWords(
  originalText: string,
  words: WordTiming[] | undefined,
  segments: TransliterationSegment[],
): { timings?: WordTiming[]; texts: string[] } {
  const displaySlots = alignTransliterationToWords(sourceSlots(originalText), segments, "dashes");
  const alignedTimings = words?.length ? alignTransliterationToWords(words, segments, "dashes") : undefined;
  return {
    ...(alignedTimings ? { timings: alignedTimings } : {}),
    texts: displaySlots.map((word) => word.transliteration || word.text),
  };
}

function syncDisplayLine(line: LyricLine, variant: SyncTextVariant): SyncDisplayLine {
  if (variant === "original" || !line.transliteration?.text) {
    return {
      text: line.text,
      backgroundText: line.backgroundText,
      words: line.words,
      backgroundWords: line.backgroundWords,
    };
  }

  const main = displayTrackWords(line.text, line.words, line.transliteration.segments);
  const background = line.backgroundText
    ? displayTrackWords(
        line.backgroundText,
        line.backgroundWords,
        line.transliteration.backgroundSegments ??
          (line.transliteration.backgroundText
            ? [{ original: line.backgroundText, transliteration: line.transliteration.backgroundText }]
            : []),
      )
    : null;
  return {
    text: normalizeTransliterationForEditing(line.transliteration.text),
    backgroundText: line.transliteration.backgroundText
      ? normalizeTransliterationForEditing(line.transliteration.backgroundText)
      : line.backgroundText,
    words: main.timings,
    backgroundWords: background?.timings,
    wordTexts: main.texts,
    backgroundWordTexts: background?.texts,
  };
}

export { syncDisplayLine };
export type { SyncDisplayLine, SyncTextVariant };
