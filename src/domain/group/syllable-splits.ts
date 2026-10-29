import { splitWordsKeepingTransliteration } from "@/domain/language/reconcile-syllable-split";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import type { WordTrack } from "@/domain/line/tracks";
import type { WordTiming } from "@/domain/word/timing";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
import { withoutSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface TrackFields {
  type: WordTrack;
  text: (line: LyricLine) => string | undefined;
  words: (line: LyricLine) => WordTiming[] | undefined;
  write: (line: LyricLine, text: string, words: WordTiming[] | undefined) => LyricLine;
}

// -- Constants ----------------------------------------------------------------

const MAIN_TRACK: TrackFields = {
  type: "word",
  text: (line) => line.text,
  words: (line) => line.words,
  write: (line, text, words) => reconcileLine({ ...line, text, words }),
};

const BACKGROUND_TRACK: TrackFields = {
  type: "bg",
  text: (line) => line.backgroundText,
  words: (line) => line.backgroundWords,
  write: (line, backgroundText, backgroundWords) => reconcileLine({ ...line, backgroundText, backgroundWords }),
};

// -- Helpers ------------------------------------------------------------------

function isSpace(char: string | undefined): boolean {
  return char !== undefined && char.trim() === "";
}

// Offsets into the split-free text where a split character divides two letters.
function textSplitOffsets(text: string, splitChar: string): Set<number> {
  const plain = withoutSplitCharacter(text, splitChar);
  const offsets = new Set<number>();
  let at = 0;
  for (const piece of text.split(splitChar).slice(0, -1)) {
    at += piece.length;
    if (at > 0 && !isSpace(plain[at - 1]) && !isSpace(plain[at]) && at < plain.length) offsets.add(at);
  }
  return offsets;
}

// Null when the timed words do not spell the start of the text word by word.
function wordSplitOffsets(words: readonly WordTiming[], plain: string): Set<number> | null {
  const offsets = new Set<number>();
  let at = plain.length - plain.trimStart().length;
  for (const word of words) {
    const content = word.text.trimEnd();
    if (content === "" || content.trim() !== content || !plain.startsWith(word.text, at)) return null;
    at += word.text.length;
    if (!isSpace(plain[at - 1]) && at < plain.length) offsets.add(at);
  }
  return offsets;
}

function trackSplitOffsets(line: LyricLine, track: TrackFields, splitChar: string): Set<number> | null {
  const text = track.text(line) ?? "";
  const offsets = textSplitOffsets(text, splitChar);
  const words = track.words(line);
  if (!words?.length) return offsets;
  const fromWords = wordSplitOffsets(words, withoutSplitCharacter(text, splitChar));
  if (!fromWords) return null;
  for (const offset of fromWords) offsets.add(offset);
  return offsets;
}

function containsAll(outer: ReadonlySet<number>, inner: ReadonlySet<number>): boolean {
  for (const offset of inner) if (!outer.has(offset)) return false;
  return true;
}

function wordRanges(plain: string): [number, number][] {
  const ranges: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= plain.length; i++) {
    const inWord = i < plain.length && !isSpace(plain[i]);
    if (inWord && start === -1) start = i;
    if (!inWord && start !== -1) {
      ranges.push([start, i]);
      start = -1;
    }
  }
  return ranges;
}

// Per word, one copy's splits must contain every other copy's: splits that cross mean the copies disagree.
function trackTargets(copies: readonly LyricLine[], track: TrackFields, splitChar: string): Set<number> | null {
  const sets: Set<number>[] = [];
  for (const copy of copies) {
    const offsets = trackSplitOffsets(copy, track, splitChar);
    if (!offsets) return null;
    sets.push(offsets);
  }
  const targets = new Set<number>();
  for (const [start, end] of wordRanges(withoutSplitCharacter(track.text(copies[0]) ?? "", splitChar))) {
    const inWord = sets.map((set) => new Set([...set].filter((offset) => offset > start && offset < end)));
    const finest = inWord.find((candidate) => inWord.every((other) => containsAll(candidate, other)));
    if (!finest) return null;
    for (const offset of finest) targets.add(offset);
  }
  return targets;
}

function withSplitsAdded(text: string, offsets: ReadonlySet<number>, splitChar: string): string {
  let result = "";
  let plainAt = 0;
  for (let i = 0; i < text.length; ) {
    if (text.startsWith(splitChar, i)) {
      result += splitChar;
      i += splitChar.length;
      continue;
    }
    if (offsets.has(plainAt)) result += splitChar;
    result += text[i];
    plainAt++;
    i++;
  }
  return result;
}

function wordSplitPoints(words: readonly WordTiming[], plain: string, offsets: ReadonlySet<number>): number[][] {
  let at = plain.length - plain.trimStart().length;
  return words.map((word) => {
    const start = at;
    at += word.text.length;
    const contentEnd = start + word.text.trimEnd().length;
    return [...offsets].filter((offset) => offset > start && offset < contentEnd).map((offset) => offset - start);
  });
}

function evenedTrack(line: LyricLine, track: TrackFields, offsets: ReadonlySet<number>, splitChar: string): LyricLine {
  const text = track.text(line);
  if (!text) return line;
  const own = trackSplitOffsets(line, track, splitChar) ?? new Set<number>();
  const added = new Set([...offsets].filter((offset) => !own.has(offset)));
  if (added.size === 0) return line;
  const target = withSplitsAdded(text, added, splitChar);
  const words = track.words(line);
  if (!words?.length) return track.write(line, target, words);

  const points = wordSplitPoints(words, withoutSplitCharacter(text, splitChar), added);
  let current = line;
  for (let index = words.length - 1; index >= 0; index--) {
    if (points[index].length === 0) continue;
    const syllables = splitWordIntoSyllables({ word: words[index], splitPoints: points[index], reuseGroupId: true });
    const split = splitWordsKeepingTransliteration(current, track.type, index, syllables);
    const currentWords = track.words(current) ?? words;
    current = track.write(current, text, split?.words ?? currentWords.toSpliced(index, 1, ...syllables));
    if (split?.transliteration) current = { ...current, transliteration: split.transliteration };
  }
  return track.write(current, target, track.words(current));
}

// -- Functions ----------------------------------------------------------------

function repeatKey(line: LyricLine, splitChar: string): string {
  return [
    line.agentId,
    withoutSplitCharacter(line.text, splitChar),
    withoutSplitCharacter(line.backgroundText ?? "", splitChar),
  ].join("\u0000");
}

// Null when the copies cannot share one split without changing their text or losing a timed boundary.
function withEvenSyllableSplits(
  lines: readonly LyricLine[],
  starts: readonly number[],
  length: number,
  splitChar: string,
): LyricLine[] | null {
  const result = [...lines];
  for (let offset = 0; offset < length; offset++) {
    const copies = starts.map((start) => lines[start + offset]);
    const key = repeatKey(copies[0], splitChar);
    if (copies.some((copy) => repeatKey(copy, splitChar) !== key)) return null;
    const mainTargets = trackTargets(copies, MAIN_TRACK, splitChar);
    const backgroundTargets = trackTargets(copies, BACKGROUND_TRACK, splitChar);
    if (!mainTargets || !backgroundTargets) return null;
    for (const start of starts) {
      const copy = lines[start + offset];
      const evened = evenedTrack(evenedTrack(copy, MAIN_TRACK, mainTargets, splitChar), BACKGROUND_TRACK, backgroundTargets, splitChar);
      result[start + offset] = evened;
    }
  }
  return result;
}

// -- Exports ------------------------------------------------------------------

export { repeatKey, withEvenSyllableSplits };
