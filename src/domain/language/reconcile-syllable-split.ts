import type { TransliterationTrack } from "@/domain/language/model";
import { sourceWordCount, timingWordGroups, transliterationWordGroups } from "@/domain/language/transliteration-format";
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
  const canonicalText = field === "words" ? track?.text : track?.backgroundText;
  if (!track || !words || !canonicalText) return null;

  const sourceGroups = timingWordGroups(words);
  const targetGroupIndex = sourceGroups.findIndex(
    (group) => wordIndex >= group.startIndex && wordIndex < group.startIndex + group.words.length,
  );
  if (targetGroupIndex < 0) return null;

  const targetGroup = sourceGroups[targetGroupIndex];
  const targetSourceText = targetGroup.words.map((word) => word.text).join("");
  if (sourceWordCount(targetSourceText) !== 1) return null;

  const localWordIndex = wordIndex - targetGroup.startIndex;
  const updatedGroupWords = targetGroup.words.toSpliced(localWordIndex, 1, ...replacementWords);
  const syllables: string[] = [];
  for (const word of updatedGroupWords) {
    const syllable = word.transliteration?.trim();
    if (!syllable) return null;
    syllables.push(syllable);
  }

  let lexicalIndex = 0;
  for (let index = 0; index < targetGroupIndex; index++) {
    const sourceText = sourceGroups[index].words.map((word) => word.text).join("");
    lexicalIndex += Math.max(1, sourceWordCount(sourceText));
  }

  const canonicalGroups = transliterationWordGroups(canonicalText);
  if (lexicalIndex >= canonicalGroups.length) return null;
  canonicalGroups[lexicalIndex] = syllables.join("-");
  const reconciledText = canonicalGroups.join(" ");
  const { stale: _stale, ...current } = track;

  if (field === "words") {
    return {
      ...current,
      text: reconciledText,
      segments: [{ original: line.text, transliteration: reconciledText }],
      origin: "manual",
    };
  }

  return {
    ...current,
    backgroundText: reconciledText,
    backgroundSegments: [{ original: line.backgroundText ?? "", transliteration: reconciledText }],
    origin: "manual",
  };
}

export { reconcileTransliterationAfterSyllableSplit };
