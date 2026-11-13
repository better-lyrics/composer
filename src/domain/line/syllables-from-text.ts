import type { LineTrack, Syllable, UntimedSyllable } from "@/domain/line/model";
import { syllablesText } from "@/domain/line/text";
import { isTimedSyllable, timedSyllables } from "@/domain/line/track";
import { lcsPairs, wordKey } from "@/domain/word/alignment";
import { newWordId } from "@/domain/word/id";
import { remapWordTextsPreservingTiming } from "@/domain/word/remap-text";
import { getSplitCharacter } from "@/utils/split-character";

// -- Tokens -------------------------------------------------------------------

const TOKEN_AND_SPACE = /(\S+)(\s*)/g;

// Text split the way Edit splits it, keeping each separator as typed. Leading whitespace has no home.
function textSyllables(text: string, splitChar = getSplitCharacter()): UntimedSyllable[] {
  const syllables: UntimedSyllable[] = [];
  for (const [, token, space] of text.matchAll(TOKEN_AND_SPACE)) {
    const parts = token.split(splitChar).filter((part) => part.length > 0);
    parts.forEach((part, index) => {
      const endsToken = index === parts.length - 1;
      syllables.push({ id: newWordId(), text: part, sep: endsToken ? space : "", joinsNext: !endsToken });
    });
  }
  const last = syllables.length - 1;
  return last >= 0 && syllables[last].joinsNext
    ? syllables.with(last, { ...syllables[last], joinsNext: false })
    : syllables;
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

// The typed parts end at the one aligned with the last timed syllable. When that syllable lost its match, the
// typed parts in its place replace it only if the run they replace was all timed; otherwise nothing new is timed.
function lastTimedPart(old: readonly Syllable[], oldIndexOf: readonly (number | undefined)[]): number {
  const lastTimed = old.findLastIndex(isTimedSyllable);
  const aligned = oldIndexOf.indexOf(lastTimed);
  if (aligned !== -1) return aligned;
  const before = oldIndexOf.findLastIndex((oldIndex) => oldIndex !== undefined && oldIndex < lastTimed);
  const after = oldIndexOf.findIndex((oldIndex) => oldIndex !== undefined && oldIndex > lastTimed);
  const replacedRunEnd = (oldIndexOf[after] ?? old.length) - 1;
  if (replacedRunEnd !== lastTimed) return before;
  return (after === -1 ? oldIndexOf.length : after) - 1;
}

// -- Functions ----------------------------------------------------------------

// Matched syllables keep id and timing; parts typed inside the timed run get today's rule, so untimed stay a tail.
function syllablesFromText(text: string, track: LineTrack | undefined, splitChar = getSplitCharacter()): Syllable[] {
  const next = textSyllables(text, splitChar);
  const old = track?.syllables ?? [];
  const timed = timedSyllables(track);
  if (timed.length === old.length && timed.length > 0) return remapWordTextsPreservingTiming(timed, text, splitChar);
  const oldIndexOf = matchedOldIndices(old, next);
  const untimed = untimedKeepingIds(next, old, oldIndexOf);
  if (timed.length === 0) return untimed;
  const boundary = lastTimedPart(old, oldIndexOf);
  if (boundary < 0) return untimed;
  const typedTimed = syllablesText(next.slice(0, boundary + 1), splitChar).trimEnd();
  const remapped = remapWordTextsPreservingTiming(timed, typedTimed, splitChar);
  const last = remapped.length - 1;
  const closing = { ...remapped[last], sep: next[boundary].sep, joinsNext: next[boundary].joinsNext };
  return [...remapped.with(last, closing), ...untimed.slice(boundary + 1)];
}

// -- Exports ------------------------------------------------------------------

export { syllablesFromText, textSyllables };
