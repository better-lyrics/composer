import { untimedTail } from "@/domain/line/line-from-fields";
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
    result += words[i].text + words[i].sep;
    if (i < words.length - 1 && !words[i].sep.endsWith(" ")) {
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
    const text = words[i].text + words[i].sep;
    const leading = text.length - text.trimStart().length;
    const trailing = text.length - text.trimEnd().length;
    spans.push({ start: cursor + leading, end: cursor + text.length - trailing });
    cursor += text.length;
    if (i < words.length - 1 && !text.endsWith(" ")) cursor += splitChar.length;
  }
  return spans;
}

// -- Untimed tail -------------------------------------------------------------

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

// A writer that left the text alone changed only the timed words, so the untimed rest of the old text
// is still the user's. A writer that rewrote the text owns it, so its own untimed rest is kept.
function derivedTrackText(
  track: TrackSnapshot,
  previous: TrackSnapshot | undefined,
  splitChar: string,
): string | undefined {
  if (!track.words || track.words.length === 0) return track.text;
  const text = track.text ?? "";
  const textUnchanged = previous?.words !== undefined && track.text === previous.text;
  const coveredWords = textUnchanged && previous.words ? previous.words : track.words;
  const tail = track.text === undefined ? "" : untimedTail(text, coveredWords, track.words);
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
