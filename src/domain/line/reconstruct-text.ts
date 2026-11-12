import type { LyricLine } from "@/domain/line/model";
import { lcsPairs } from "@/domain/word/alignment";
import type { WordTiming } from "@/domain/word/timing";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Text reconstruction ------------------------------------------------------

// Rebuilds a line's text from its word array. Word texts carry their trailing
// space when a real space follows; two adjacent words with no space between
// them are syllables of one token, so the split character is reinserted at that
// joint. The result tokenizes 1:1 back to the same word count.
function reconstructLineText(words: WordTiming[], splitChar: string): string {
  let result = "";
  for (let i = 0; i < words.length; i++) {
    result += words[i].text;
    if (i < words.length - 1 && !words[i].text.endsWith(" ")) {
      result += splitChar;
    }
  }
  return result;
}

// -- Word content spans -------------------------------------------------------

interface WordContentSpan {
  start: number;
  end: number;
}

// Maps each word to the half-open char range [start, end) of its non-whitespace
// content within reconstructLineText's output. Mirrors that function's
// splitChar-insertion logic, so the two must evolve together.
function wordContentSpans(words: WordTiming[], splitChar: string): WordContentSpan[] {
  const spans: WordContentSpan[] = [];
  let cursor = 0;
  for (let i = 0; i < words.length; i++) {
    const text = words[i].text;
    const leading = text.length - text.trimStart().length;
    const trailing = text.length - text.trimEnd().length;
    spans.push({ start: cursor + leading, end: cursor + text.length - trailing });
    cursor += text.length;
    if (i < words.length - 1 && !text.endsWith(" ")) cursor += splitChar.length;
  }
  return spans;
}

// -- Untimed tail -------------------------------------------------------------

function wordAtoms(words: WordTiming[]): string[] {
  return words.flatMap((word) => splitIntoWordsWithMeta(word.text).parts);
}

function joinedParts(tokens: { parts: string[]; trailingSpace: boolean[] }, from: number, splitChar: string): string {
  let joined = "";
  for (let i = from; i < tokens.parts.length; i++) {
    joined += tokens.parts[i];
    if (i < tokens.parts.length - 1) joined += tokens.trailingSpace[i] ? " " : splitChar;
  }
  return joined;
}

// The words of a partly synced track cover the start of its text; the rest is lyrics not timed yet.
// Words added after the last surviving timed word that spell the start of that rest were just timed,
// so they leave it. Returns the rest with the separator that leads into it, or "" when nothing is left.
function untimedTail(text: string, previousWords: WordTiming[], words: WordTiming[], splitChar: string): string {
  const written = splitIntoWordsWithMeta(text);
  const covered = wordAtoms(previousWords);
  if (covered.length === 0 || covered.length >= written.parts.length) return "";
  if (covered.some((atom, i) => atom !== written.parts[i])) return "";
  const timed = wordAtoms(words);
  const pairs = lcsPairs(covered, timed);
  const added = timed.slice(pairs.length > 0 ? pairs[pairs.length - 1][1] + 1 : 0);
  const tail = written.parts.slice(covered.length);
  let nowTimed = Math.min(added.length, tail.length);
  while (nowTimed > 0 && added.slice(added.length - nowTimed).some((atom, i) => atom !== tail[i])) nowTimed--;
  const start = covered.length + nowTimed;
  if (start >= written.parts.length) return "";
  const separator = written.trailingSpace[start - 1] ? " " : splitChar;
  return `${separator}${joinedParts(written, start, splitChar)}`;
}

function withTail(timedText: string, tail: string, splitChar: string): string {
  if (tail === "") return timedText;
  const endsWithSpace = timedText.trimEnd() !== timedText;
  if (tail.startsWith(" ")) return `${timedText.trimEnd()}${tail}`;
  return endsWithSpace ? `${timedText}${tail.slice(splitChar.length)}` : `${timedText}${tail}`;
}

interface TrackSnapshot {
  text: string | undefined;
  words: WordTiming[] | undefined;
}

// A writer that left the text alone changed only the timed words, so the untimed tail is still the user's.
function derivedTrackText(
  track: TrackSnapshot,
  previous: TrackSnapshot | undefined,
  splitChar: string,
): string | undefined {
  if (!track.words || track.words.length === 0) return track.text;
  const keepsTail = previous?.words && track.text !== undefined && track.text === previous.text;
  const tail = keepsTail && previous.words ? untimedTail(track.text ?? "", previous.words, track.words, splitChar) : "";
  return withTail(reconstructLineText(track.words, splitChar), tail, splitChar);
}

// A track's text is rebuilt from its words where they are timed and kept where they are not, so a
// partly synced line never loses its untimed lyrics. Returns the same reference when nothing changes.
function withDerivedText(line: LyricLine, splitChar: string, previous?: LyricLine): LyricLine {
  const main = previous && { text: previous.text, words: previous.words };
  const background = previous && { text: previous.backgroundText, words: previous.backgroundWords };
  const text = derivedTrackText({ text: line.text, words: line.words }, main, splitChar) ?? line.text;
  const backgroundText = derivedTrackText(
    { text: line.backgroundText, words: line.backgroundWords },
    background,
    splitChar,
  );
  if (text === line.text && backgroundText === line.backgroundText) return line;
  return { ...line, text, backgroundText };
}

// -- Exports ------------------------------------------------------------------

export { reconstructLineText, withDerivedText, wordContentSpans };
