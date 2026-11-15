import { splitWordsKeepingTransliteration } from "@/domain/language/reconcile-syllable-split";
import type { LineTrack, LyricLine, TrackRole } from "@/domain/line/model";
import { syllablesFromText } from "@/domain/line/syllables-from-text";
import { trackText } from "@/domain/line/text";
import {
  backgroundTrack,
  isTimedSyllable,
  mainTrack,
  roleWords,
  untimedSyllable,
  type WordTrack,
} from "@/domain/line/track";
import { withRoleTrack, withTrackSyllables, withTrackText } from "@/domain/line/track-writes";
import type { WordTiming } from "@/domain/word/timing";
import { splitWordIntoSyllables } from "@/utils/single-word-syllable-split";
import { withoutSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface TrackFields {
  type: WordTrack;
  text: (line: LyricLine, splitChar: string) => string | undefined;
  words: (line: LyricLine) => WordTiming[] | undefined;
  writeWords: (line: LyricLine, words: WordTiming[]) => LyricLine;
  write: (line: LyricLine, text: string, words: WordTiming[] | undefined, splitChar: string) => LyricLine;
}

// -- Constants ----------------------------------------------------------------

// The timed words lead the track; the untimed syllables after them stay as they are.
function wordsWriter(role: TrackRole): TrackFields["writeWords"] {
  return (line, words) =>
    withRoleTrack(line, role, (track) =>
      withTrackSyllables(track, [...words, ...track.syllables.filter((syllable) => !isTimedSyllable(syllable))]),
    );
}

// The timed words keep their own text; the text gives the joint after them and the untimed syllables that follow.
function textedSyllables(track: LineTrack, text: string, words: readonly WordTiming[], splitChar: string) {
  const parts = syllablesFromText(text, { ...track, syllables: track.syllables.map(untimedSyllable) }, splitChar);
  const last = words.length - 1;
  const closing = {
    ...words[last],
    sep: parts[last]?.sep ?? words[last].sep,
    joinsNext: parts[last]?.joinsNext ?? false,
  };
  return [...words.with(last, closing), ...parts.slice(words.length)];
}

function textAndWordsWriter(role: TrackRole): TrackFields["write"] {
  return (line, text, words, splitChar) =>
    withRoleTrack(line, role, (track) =>
      words?.length
        ? withTrackSyllables(track, textedSyllables(track, text, words, splitChar))
        : withTrackText(track, text, splitChar),
    );
}

const MAIN_TRACK: TrackFields = {
  type: "word",
  text: (line, splitChar) => trackText(mainTrack(line), splitChar),
  words: (line) => roleWords(line, "main"),
  writeWords: wordsWriter("main"),
  write: textAndWordsWriter("main"),
};

const BACKGROUND_TRACK: TrackFields = {
  type: "bg",
  text: (line, splitChar) => {
    const track = backgroundTrack(line);
    return track && trackText(track, splitChar);
  },
  words: (line) => roleWords(line, "bg"),
  writeWords: wordsWriter("bg"),
  write: textAndWordsWriter("bg"),
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
    const spaced = word.text + word.sep;
    if (word.text === "" || word.text.trim() !== word.text || !plain.startsWith(spaced, at)) return null;
    at += spaced.length;
    if (!isSpace(plain[at - 1]) && at < plain.length) offsets.add(at);
  }
  return offsets;
}

function trackSplitOffsets(line: LyricLine, track: TrackFields, splitChar: string): Set<number> | null {
  const text = track.text(line, splitChar) ?? "";
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
  for (const [start, end] of wordRanges(withoutSplitCharacter(track.text(copies[0], splitChar) ?? "", splitChar))) {
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
    at += word.text.length + word.sep.length;
    const contentEnd = start + word.text.length;
    return [...offsets].filter((offset) => offset > start && offset < contentEnd).map((offset) => offset - start);
  });
}

function evenedTrack(line: LyricLine, track: TrackFields, offsets: ReadonlySet<number>, splitChar: string): LyricLine {
  const text = track.text(line, splitChar);
  if (!text) return line;
  const plain = withoutSplitCharacter(text, splitChar);
  const words = track.words(line);
  const textSplits = textSplitOffsets(text, splitChar);
  const wordSplits = (words?.length && wordSplitOffsets(words, plain)) || new Set<number>();
  const addedToText = new Set([...offsets].filter((offset) => !textSplits.has(offset)));
  const addedToWords = new Set([...offsets].filter((offset) => !wordSplits.has(offset)));
  if (addedToText.size === 0 && (!words?.length || addedToWords.size === 0)) return line;
  const target = withSplitsAdded(text, addedToText, splitChar);
  if (!words?.length) return track.write(line, target, words, splitChar);

  const points = wordSplitPoints(words, plain, addedToWords);
  if (points.every((wordPoints) => wordPoints.length === 0)) return track.write(line, target, words, splitChar);
  let current = line;
  for (let index = words.length - 1; index >= 0; index--) {
    if (points[index].length === 0) continue;
    const syllables = splitWordIntoSyllables({ word: words[index], splitPoints: points[index] });
    const split = splitWordsKeepingTransliteration(current, track.type, index, syllables);
    const currentWords = track.words(current) ?? words;
    current = track.writeWords(current, split?.words ?? currentWords.toSpliced(index, 1, ...syllables));
    if (split) current = { ...current, languages: split.languages };
  }
  return track.write(current, target, track.words(current), splitChar);
}

// -- Functions ----------------------------------------------------------------

function repeatKey(line: LyricLine, splitChar: string): string {
  return [
    mainTrack(line).agentId,
    withoutSplitCharacter(MAIN_TRACK.text(line, splitChar) ?? "", splitChar),
    withoutSplitCharacter(BACKGROUND_TRACK.text(line, splitChar) ?? "", splitChar),
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
      const evened = evenedTrack(
        evenedTrack(copy, MAIN_TRACK, mainTargets, splitChar),
        BACKGROUND_TRACK,
        backgroundTargets,
        splitChar,
      );
      result[start + offset] = evened;
    }
  }
  return result;
}

// -- Exports ------------------------------------------------------------------

export { repeatKey, withEvenSyllableSplits };
