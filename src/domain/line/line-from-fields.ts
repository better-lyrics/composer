import type { LineTrack, Syllable, UntimedSyllable } from "@/domain/line/track";
import type { LyricLine } from "@/domain/line/model";
import { lcsPairs } from "@/domain/word/alignment";
import { newWordId } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Untimed tail -------------------------------------------------------------

function wordAtoms(words: WordTiming[]): string[] {
  return words.flatMap((word) => splitIntoWordsWithMeta(word.text).parts);
}

// Where each part of the text ends, found by walking the parts the shared tokenizer returned.
function partEnds(text: string, parts: string[]): number[] {
  const ends: number[] = [];
  let cursor = 0;
  for (const part of parts) {
    cursor = text.indexOf(part, cursor) + part.length;
    ends.push(cursor);
  }
  return ends;
}

// The last new word that matches an old one, aligning old words as early as they can go, so a word
// repeated later in the line is never mistaken for the one that was already timed.
function lastSurvivingIndex(covered: string[], timed: string[]): number {
  const reversedPairs = lcsPairs(covered.toReversed(), timed.toReversed());
  if (reversedPairs.length === 0) return -1;
  return timed.length - 1 - Math.min(...reversedPairs.map(([, timedIndex]) => timedIndex));
}

// The words of a partly synced track cover the start of its text; the rest is lyrics not timed yet.
// Words added after the last surviving timed word that spell the start of that rest were just timed,
// so they leave it. Returns the rest as typed, with the separator that leads into it.
function untimedTail(text: string, previousWords: WordTiming[], words: WordTiming[]): string {
  const written = splitIntoWordsWithMeta(text);
  const covered = wordAtoms(previousWords);
  if (covered.length === 0 || covered.length >= written.parts.length) return "";
  if (covered.some((atom, i) => atom !== written.parts[i])) return "";
  const timed = wordAtoms(words);
  const added = timed.slice(lastSurvivingIndex(covered, timed) + 1);
  const tail = written.parts.slice(covered.length);
  let nowTimed = Math.min(added.length, tail.length);
  while (nowTimed > 0 && added.slice(added.length - nowTimed).some((atom, i) => atom !== tail[i])) nowTimed--;
  const start = covered.length + nowTimed;
  if (start >= written.parts.length) return "";
  return text.slice(partEnds(text, written.parts)[start - 1]);
}

// -- Tracks -------------------------------------------------------------------

function untimedSyllables(text: string): UntimedSyllable[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  return parts.map((part, index) => ({ id: newWordId(), text: part, sep: trailingSpace[index] ? " " : "" }));
}

function syllablesOf(text: string, words: WordTiming[] | undefined): readonly Syllable[] {
  if (!words?.length) return untimedSyllables(text);
  const tail = untimedTail(text, words, words);
  return tail === "" ? words : [...words, ...untimedSyllables(tail)];
}

function mainTrackFromFields(line: LyricLine): LineTrack {
  const syllables = syllablesOf(line.text, line.words);
  const span = line.words?.length || line.begin === undefined ? {} : { begin: line.begin, end: line.end };
  return { id: `${line.id}:main`, role: "main", syllables, ...span };
}

function backgroundTrackFromFields(line: LyricLine): LineTrack | undefined {
  const { backgroundText, backgroundWords, backgroundTextSource } = line;
  if (backgroundText === undefined && backgroundWords === undefined && backgroundTextSource === undefined) {
    return undefined;
  }
  const syllables = syllablesOf(backgroundText ?? "", backgroundWords);
  return {
    id: `${line.id}:bg`,
    role: "bg",
    syllables,
    ...(backgroundTextSource ? { source: backgroundTextSource } : {}),
  };
}

// Today's flat line fields read as tracks: the timed words first, then the untimed rest of the text.
function tracksFromFields(line: LyricLine): readonly [LineTrack] | readonly [LineTrack, LineTrack] {
  const main = mainTrackFromFields(line);
  const background = backgroundTrackFromFields(line);
  return background ? [main, background] : [main];
}

// -- Exports ------------------------------------------------------------------

export { tracksFromFields, untimedTail };
