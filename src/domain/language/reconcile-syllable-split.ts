import { mappedTransliteration, withAlignedWords } from "@/domain/language/align";
import type { TransliterationAlignmentStatus, TransliterationTrack } from "@/domain/language/model";
import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/tracks";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface WordSplitResult {
  words: WordTiming[];
  transliteration: TransliterationTrack | null;
}

// -- Functions ----------------------------------------------------------------

function trackWithText(
  line: LyricLine,
  track: TransliterationTrack,
  type: WordTrack,
  text: string,
  status: TransliterationAlignmentStatus | undefined,
): TransliterationTrack {
  const { stale: _stale, ...current } = track;
  if (type === "word") {
    return {
      ...current,
      text,
      segments: [{ original: line.text, transliteration: text }],
      origin: "manual",
      alignmentStatus: status,
    };
  }
  return {
    ...current,
    backgroundText: text,
    backgroundSegments: [{ original: line.backgroundText ?? "", transliteration: text }],
    origin: "manual",
    backgroundAlignmentStatus: status,
  };
}

function splitWordsKeepingTransliteration(
  line: LyricLine,
  type: WordTrack,
  wordIndex: number,
  replacementWords: WordTiming[],
): WordSplitResult | null {
  const aligned = withAlignedWords(line);
  const base = effectiveTrackWords(aligned, type);
  if (!base?.length) return null;

  const words = base.toSpliced(wordIndex, 1, ...replacementWords);
  const track = aligned.transliteration;
  const text = track ? mappedTransliteration(words) : null;
  if (!track || text === null) return { words, transliteration: null };

  const status = type === "word" ? track.alignmentStatus : track.backgroundAlignmentStatus;
  return { words, transliteration: trackWithText(line, track, type, text, status) };
}

// -- Exports ------------------------------------------------------------------

export { splitWordsKeepingTransliteration };
