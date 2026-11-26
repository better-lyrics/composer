import { syllableJoint, syllablesText } from "@/domain/line/text";
import type { WordTiming } from "@/domain/word/timing";
import { withoutSplitCharacter } from "@/utils/split-character";

// -- Word content spans -------------------------------------------------------

interface WordContentSpan {
  start: number;
  end: number;
}

// Maps each word to the half-open char range [start, end) of its non-whitespace content within
// syllablesText's output, reading the joints from the same owner.
function wordContentSpans(words: WordTiming[], splitChar: string): WordContentSpan[] {
  const spans: WordContentSpan[] = [];
  let cursor = 0;
  for (let i = 0; i < words.length; i++) {
    const text = words[i].text + words[i].sep;
    const leading = text.length - text.trimStart().length;
    const trailing = text.length - text.trimEnd().length;
    spans.push({ start: cursor + leading, end: cursor + text.length - trailing });
    cursor += words[i].text.length + syllableJoint(words, i, splitChar).length;
  }
  return spans;
}

// -- Split mark repair ----------------------------------------------------------

// Older versions split words without marking the split in the text. Only that difference is repaired.
function withSplitMarksFromWords(text: string, words: readonly WordTiming[], splitChar: string): string {
  const derived = syllablesText(words, splitChar);
  if (derived === text) return text;
  return withoutSplitCharacter(derived, splitChar) === withoutSplitCharacter(text, splitChar) ? derived : text;
}

// -- Exports ------------------------------------------------------------------

export { withSplitMarksFromWords, wordContentSpans };
