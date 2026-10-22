import { mappedTransliteration, withAlignedWords } from "@/domain/language/align";
import { wholeLineSegments } from "@/domain/language/manual-segments";
import type { TransliterationAlignmentStatus, TransliterationTrack } from "@/domain/language/model";
import { effectiveTrackWords } from "@/domain/line/effective-words";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { trackWords, type WordTrack } from "@/domain/line/tracks";
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
      segments: wholeLineSegments(line.text, text),
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

function withoutPiece(word: WordTiming): WordTiming {
  const { transliteration: _piece, transliterationJoinerAfter: _joiner, ...rest } = word;
  return rest;
}

function compactPiece(value: string | null | undefined): string {
  return value?.replace(/\s+/g, "") ?? "";
}

// A split moves boundaries only: its pieces must spell the split word's piece.
function keepsSplitPiece(splitWord: WordTiming | undefined, replacementWords: WordTiming[]): boolean {
  const piece = compactPiece(splitWord?.transliteration);
  return piece !== "" && compactPiece(mappedTransliteration(replacementWords)) === piece;
}

function splitWordsKeepingTransliteration(
  line: LyricLine,
  type: WordTrack,
  wordIndex: number,
  replacementWords: WordTiming[],
): WordSplitResult | null {
  const effective = effectiveTrackWords(line, type);
  if (!effective?.length) return null;
  const aligned = withAlignedWords(
    reconcileLine(type === "word" ? { ...line, words: effective } : { ...line, backgroundWords: effective }),
  );
  const base = trackWords(aligned, type) ?? effective;

  const words = base.toSpliced(
    wordIndex,
    1,
    ...(keepsSplitPiece(base[wordIndex], replacementWords) ? replacementWords : replacementWords.map(withoutPiece)),
  );
  const track = aligned.transliteration;
  const text = track ? mappedTransliteration(words) : null;
  if (!track || text === null) return { words, transliteration: null };

  const status = type === "word" ? track.alignmentStatus : track.backgroundAlignmentStatus;
  return { words, transliteration: trackWithText(line, track, type, text, status) };
}

// -- Exports ------------------------------------------------------------------

export { splitWordsKeepingTransliteration };
