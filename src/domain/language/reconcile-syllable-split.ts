import { mappedTransliteration } from "@/domain/language/align";
import type { TransliterationTrack } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

type TimingField = "words" | "backgroundWords";

function reconcileTransliterationAfterSyllableSplit(
  line: LyricLine,
  field: TimingField,
  wordIndex: number,
  replacementWords: WordTiming[],
): TransliterationTrack | null {
  const track = line.transliteration;
  const words = line[field];
  if (!track || !words) return null;

  const updatedWords = words.toSpliced(wordIndex, 1, ...replacementWords);
  const reconciledText = mappedTransliteration(updatedWords);
  if (reconciledText === null) return null;
  const { stale: _stale, ...current } = track;

  if (field === "words") {
    return {
      ...current,
      text: reconciledText,
      segments: [{ original: line.text, transliteration: reconciledText }],
      origin: "manual",
      alignmentStatus: "confirmed",
    };
  }

  return {
    ...current,
    backgroundText: reconciledText,
    backgroundSegments: [{ original: line.backgroundText ?? "", transliteration: reconciledText }],
    origin: "manual",
    backgroundAlignmentStatus: "confirmed",
  };
}

export { reconcileTransliterationAfterSyllableSplit };
