import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

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

const WHITESPACE_RUN = /\s+/;

function isWhitespace(char: string): boolean {
  return char !== "" && char.trim() === "";
}

function tokenEnds(text: string, splitChar: string): { token: string; end: number }[] {
  const tokens: { token: string; end: number }[] = [];
  let start = -1;
  let i = 0;
  const close = (end: number) => {
    if (start >= 0) tokens.push({ token: text.slice(start, end), end });
    start = -1;
  };
  while (i < text.length) {
    if (isWhitespace(text[i])) {
      close(i);
      i++;
    } else if (splitChar !== "" && text.startsWith(splitChar, i)) {
      close(i);
      i += splitChar.length;
    } else {
      if (start < 0) start = i;
      i++;
    }
  }
  close(text.length);
  return tokens;
}

function wordAtoms(words: WordTiming[]): string[] {
  return words.flatMap((word) => word.text.split(WHITESPACE_RUN).filter((atom) => atom.length > 0));
}

// The words of a partly synced track cover the start of its text; the rest is lyrics not timed yet.
// Untimed words that the new timed words now end with were just timed, so they leave the tail.
function untimedTail(text: string, previousWords: WordTiming[], words: WordTiming[], splitChar: string): string {
  const covered = wordAtoms(previousWords);
  const tokens = tokenEnds(text, splitChar);
  if (covered.length === 0 || covered.length >= tokens.length) return "";
  if (covered.some((atom, i) => atom !== tokens[i].token)) return "";
  const timed = wordAtoms(words);
  let shared = 0;
  while (shared < covered.length && shared < timed.length && covered[shared] === timed[shared]) shared++;
  const added = timed.slice(shared);
  const tail = tokens.slice(covered.length).map((entry) => entry.token);
  let nowTimed = Math.min(added.length, tail.length);
  while (nowTimed > 0 && added.slice(added.length - nowTimed).some((atom, i) => atom !== tail[i])) nowTimed--;
  if (nowTimed === tail.length) return "";
  return text.slice(tokens[covered.length + nowTimed - 1].end);
}

function withTail(timedText: string, tail: string, splitChar: string): string {
  if (tail === "") return timedText;
  let start = 0;
  while (start < tail.length) {
    if (isWhitespace(tail[start])) start++;
    else if (splitChar !== "" && tail.startsWith(splitChar, start)) start += splitChar.length;
    else break;
  }
  const content = tail.slice(start);
  if (isWhitespace(tail[0])) return `${timedText.trimEnd()} ${content}`;
  return isWhitespace(timedText.at(-1) ?? "") ? `${timedText}${content}` : `${timedText}${splitChar}${content}`;
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
