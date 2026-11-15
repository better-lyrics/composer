import type { LineTrack, Syllable, UntimedSyllable } from "@/domain/line/model";
import { timedSyllables } from "@/domain/line/track";
import { lcsPairs, wordKey } from "@/domain/word/alignment";
import { newWordId } from "@/domain/word/id";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import { textParts } from "@/domain/word/text-parts";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Tokens -------------------------------------------------------------------

// Text split the way Edit splits it, keeping each separator as typed.
function textSyllables(text: string, splitChar = getSplitCharacter()): UntimedSyllable[] {
  return textParts(text, splitChar).map((part) => ({ id: newWordId(), ...part }));
}

// -- Matching -----------------------------------------------------------------

function matchedOldIndices(old: readonly Syllable[], next: readonly UntimedSyllable[]): (number | undefined)[] {
  const oldIndexOf = new Array<number | undefined>(next.length);
  const pairs = lcsPairs(
    old.map((syllable) => wordKey(syllable.text)),
    next.map((syllable) => wordKey(syllable.text)),
  );
  for (const [oldIndex, nextIndex] of pairs) oldIndexOf[nextIndex] = oldIndex;
  return oldIndexOf;
}

function untimedKeepingIds(
  next: readonly UntimedSyllable[],
  old: readonly Syllable[],
  oldIndexOf: readonly (number | undefined)[],
): UntimedSyllable[] {
  return next.map((syllable, index) => {
    const oldIndex = oldIndexOf[index];
    return oldIndex === undefined ? syllable : { ...syllable, id: old[oldIndex].id };
  });
}

// A word placed after every timed word, with no time of its own, is what the timed words never reached.
function timedLength(remapped: readonly WordTiming[], timedIds: ReadonlySet<string>): number {
  let length = remapped.length;
  while (length > 0) {
    const word = remapped[length - 1];
    if (timedIds.has(word.id) || word.end > word.begin) break;
    length--;
  }
  return length;
}

// -- Functions ----------------------------------------------------------------

// The timed syllables take the typed text the way timed words always have; the parts they never reach stay an untimed
// tail, keeping the ids of the untimed syllables they match.
function syllablesFromText(text: string, track: LineTrack | undefined, splitChar = getSplitCharacter()): Syllable[] {
  const next = textSyllables(text, splitChar);
  const old = track?.syllables ?? [];
  const timed = timedSyllables(track);
  if (timed.length === old.length && timed.length > 0) return remapWordTextsPreservingTiming(timed, text, splitChar);
  const oldIndexOf = matchedOldIndices(old, next);
  const untimed = untimedKeepingIds(next, old, oldIndexOf);
  if (timed.length === 0) return untimed;
  const remapped = remapWordTextsPreservingTiming(timed, text, splitChar);
  const length = timedLength(remapped, new Set(timed.map((syllable) => syllable.id)));
  return [...remapped.slice(0, length), ...untimed.slice(length)];
}

// -- Exports ------------------------------------------------------------------

export { syllablesFromText, textSyllables };
