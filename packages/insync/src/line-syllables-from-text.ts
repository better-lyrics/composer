import type { LineTrack, Syllable, UntimedSyllable } from "./line";
import { timedSyllables, untimedSyllable } from "./line-track";
import { lcsPairs, wordKey } from "./word-alignment";
import { newWordId } from "./word-id";
import { remapWordTextsWithinLimit } from "./word-remap-text";
import { textParts } from "./word-text-parts";
import type { WordTiming } from "./word-timing";

// -- Tokens -------------------------------------------------------------------

// Text split the way Edit splits it, keeping each separator as typed.
function textSyllables(text: string, splitChar: string): UntimedSyllable[] {
  return textParts(text, splitChar).map((part) => ({ id: newWordId(), ...part }));
}

// -- Matching -----------------------------------------------------------------

function matchedOldIndices(
  old: readonly Syllable[],
  next: readonly UntimedSyllable[],
  splitChar: string,
): (number | undefined)[] {
  const oldIndexOf = new Array<number | undefined>(next.length);
  const pairs = lcsPairs(
    old.map((syllable) => wordKey(syllable.text, splitChar)),
    next.map((syllable) => wordKey(syllable.text, splitChar)),
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
function syllablesFromText(
  text: string,
  track: LineTrack | undefined,
  splitChar: string,
  limit = Number.POSITIVE_INFINITY,
): Syllable[] {
  const next = textSyllables(text, splitChar);
  const old = track?.syllables ?? [];
  const timed = timedSyllables(track);
  if (timed.length === 0) return untimedKeepingIds(next, old, matchedOldIndices(old, next, splitChar));
  const { words: remapped, untimedFrom } = remapWordTextsWithinLimit(timed, text, splitChar, limit);
  if (untimedFrom < remapped.length)
    return [...remapped.slice(0, untimedFrom), ...remapped.slice(untimedFrom).map(untimedSyllable)];
  const length = timedLength(remapped, new Set(timed.map((syllable) => syllable.id)));
  if (length === remapped.length) return remapped;
  if (remapped.length !== next.length)
    return [...remapped.slice(0, length), ...remapped.slice(length).map(untimedSyllable)];
  const untimed = untimedKeepingIds(next, old, matchedOldIndices(old, next, splitChar));
  return [...remapped.slice(0, length), ...untimed.slice(length)];
}

// -- Exports ------------------------------------------------------------------

export { syllablesFromText, textSyllables };
