import type { TransliterationSegment } from "@/domain/language/model";
import {
  normalizeTransliterationForEditing,
  sourceWordCount,
  timingWordGroups,
  transliterationForTimeline,
  transliterationSyllables,
  transliterationWordGroups,
} from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

type SyllableDisplay = "spaces" | "dashes";

function alignTransliterationToWords(
  words: WordTiming[],
  segments: TransliterationSegment[],
  syllableDisplay: SyllableDisplay = "spaces",
): WordTiming[] {
  if (words.length === 0 || segments.length === 0) return words;
  const romanGroups = transliterationWordGroups(segments.map((segment) => segment.transliteration).join(" "));
  const sourceGroups = timingWordGroups(words);
  const lexicalCounts = sourceGroups.map((group) =>
    Math.max(1, sourceWordCount(group.words.map((word) => word.text).join(""))),
  );
  const timedLexicalCount = lexicalCounts.reduce((sum, count) => sum + count, 0);
  // Sync builds a word-timed line from left to right. A partially timed line
  // therefore has fewer canonical slots than its complete transliteration.
  if (romanGroups.length < timedLexicalCount) return words;

  const result = words.slice();
  let romanIndex = 0;
  for (let index = 0; index < sourceGroups.length; index++) {
    const group = sourceGroups[index];
    const lexicalCount = lexicalCounts[index];
    const assignedGroups = romanGroups.slice(romanIndex, romanIndex + lexicalCount);
    romanIndex += lexicalCount;
    if (group.words.length === 1) {
      const wordIndex = group.startIndex;
      if (syllableDisplay === "dashes" || !result[wordIndex].transliteration) {
        result[wordIndex] = {
          ...result[wordIndex],
          transliteration: assignedGroups
            .map((value) =>
              syllableDisplay === "dashes"
                ? normalizeTransliterationForEditing(value)
                : transliterationForTimeline(value),
            )
            .join(" "),
        };
      }
      continue;
    }
    if (lexicalCount > 1 && lexicalCount === group.words.length) {
      for (let wordOffset = 0; wordOffset < group.words.length; wordOffset++) {
        const wordIndex = group.startIndex + wordOffset;
        if (syllableDisplay === "dashes" || !result[wordIndex].transliteration) {
          result[wordIndex] = {
            ...result[wordIndex],
            transliteration:
              syllableDisplay === "dashes"
                ? normalizeTransliterationForEditing(assignedGroups[wordOffset])
                : transliterationForTimeline(assignedGroups[wordOffset]),
          };
        }
      }
      continue;
    }
    if (lexicalCount !== 1) return words;
    const syllables = transliterationSyllables(assignedGroups[0]);
    if (syllables.length !== group.words.length) return words;
    for (let syllableIndex = 0; syllableIndex < group.words.length; syllableIndex++) {
      const wordIndex = group.startIndex + syllableIndex;
      if (!result[wordIndex].transliteration) {
        result[wordIndex] = { ...result[wordIndex], transliteration: syllables[syllableIndex] };
      }
    }
  }
  return result;
}

function withAlignedTransliteration(line: LyricLine, syllableDisplay: SyllableDisplay = "spaces"): LyricLine {
  const track = line.transliteration;
  if (!track) return line;
  const mainSegments = track.segments.length ? track.segments : [{ original: line.text, transliteration: track.text }];
  const backgroundSegments = track.backgroundSegments?.length
    ? track.backgroundSegments
    : line.backgroundText && track.backgroundText
      ? [{ original: line.backgroundText, transliteration: track.backgroundText }]
      : undefined;
  return {
    ...line,
    ...(line.words ? { words: alignTransliterationToWords(line.words, mainSegments, syllableDisplay) } : {}),
    ...(line.backgroundWords && backgroundSegments
      ? { backgroundWords: alignTransliterationToWords(line.backgroundWords, backgroundSegments, syllableDisplay) }
      : {}),
  } as LyricLine;
}

export { alignTransliterationToWords, withAlignedTransliteration };
export type { SyllableDisplay };
