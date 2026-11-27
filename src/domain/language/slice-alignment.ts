import { applySlices, timedPrefixText } from "@/domain/language/align";
import { confirmTransliterationAlignment } from "@/domain/language/review";
import {
  leadingUntimedSeparator,
  normalizeTransliterationForEditing,
  splitTransliterationAtBoundaries,
} from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type SliceAlignment = { words: WordTiming[] } | { error: string };
type LinePart = "main" | "background";

// -- Helpers ------------------------------------------------------------------

function contentPositions(value: string): number[] {
  const positions: number[] = [];
  for (let index = 0; index < value.length; index++) {
    if (!leadingUntimedSeparator(value[index])) positions.push(index);
  }
  return positions;
}

function compact(value: string): string {
  return contentPositions(value)
    .map((index) => value[index])
    .join("");
}

// -- Functions ----------------------------------------------------------------

/**
 * The Align modal's split points, given as one reading slice per timed
 * syllable instead of clicks. Spaces and dashes are separators, never content,
 * so the slices only have to spell the reading in order.
 */
function alignTransliterationToSlices(words: WordTiming[], rawText: string, slices: string[]): SliceAlignment {
  if (slices.length !== words.length) {
    return { error: `Expected ${words.length} slices, one per timed syllable, got ${slices.length}.` };
  }
  const text = normalizeTransliterationForEditing(rawText);
  const positions = contentPositions(text);
  const compactSlices = slices.map(compact);
  const emptyIndex = compactSlices.findIndex((slice) => !slice);
  if (emptyIndex >= 0) {
    return { error: `Slice ${emptyIndex + 1} is empty. Every timed syllable needs part of the reading.` };
  }
  if (compactSlices.join("") !== compact(text)) {
    return { error: `The slices must spell the reading "${text}" in order, ignoring spaces and dashes.` };
  }
  const boundaries: number[] = [];
  let consumed = 0;
  for (const slice of compactSlices.slice(0, -1)) {
    consumed += slice.length;
    boundaries.push(positions[consumed]);
  }
  return { words: applySlices(words, splitTransliterationAtBoundaries(text, boundaries)) };
}

/** Line updates that save slices the way the Align modal saves split points: mapped and confirmed. */
function alignLineToSlices(
  line: LyricLine,
  part: LinePart,
  slices: string[],
): { updates: Partial<LyricLine> } | { error: string } {
  const field = part === "main" ? "words" : "backgroundWords";
  const words = line[field];
  const reading = part === "main" ? line.transliteration?.text : line.transliteration?.backgroundText;
  if (!reading?.trim()) return { error: `This line has no ${part} transliteration to align.` };
  if (!words?.length) return { error: `This line's ${part} lyrics have no timed syllables.` };
  const source = part === "main" ? line.text : (line.backgroundText ?? "");
  const result = alignTransliterationToSlices(words, timedPrefixText(source, words, reading), slices);
  if ("error" in result) return result;
  const transliteration = confirmTransliterationAlignment(line, field);
  return {
    updates:
      part === "main" ? { words: result.words, transliteration } : { backgroundWords: result.words, transliteration },
  };
}

// -- Exports ------------------------------------------------------------------

export { alignLineToSlices, alignTransliterationToSlices };
