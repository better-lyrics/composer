import type { LyricLine } from "@/domain/line/model";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { withRoleWords } from "@/domain/line/track-writes";
import type { WordTiming } from "@/domain/word/timing";
import { parseTtmlTimestamp } from "@/utils/lyrics-parsers/ttml-helpers";

// -- Types --------------------------------------------------------------------

interface ExportTimingReading {
  markedLines: number;
  checkedLines: number;
}

// -- Constants ----------------------------------------------------------------

const RESIDUE = 7;
const MAX_SHIFT_MS = 3;
const MIN_SETTLED_MS = 7;
const MARKED_SHARE = 0.75;
const BACKGROUND_OPEN = '<span ttm:role="x-bg"';
const SPAN_TIMES = /<span begin="([^"]+)" end="([^"]+)"/g;
const MIN_READ_SPAN_MS = MIN_SETTLED_MS + 2 * MAX_SHIFT_MS;

// -- Functions ----------------------------------------------------------------

function toMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

function shiftTo(ms: number, residue: number): number {
  return ((residue - (ms % RESIDUE) + RESIDUE + MAX_SHIFT_MS) % RESIDUE) - MAX_SHIFT_MS;
}

function settleTrack(words: readonly WordTiming[], residue: number): WordTiming[] {
  const settled = words.map((word) => ({ ...word }));
  for (let i = 1; i < settled.length; i++) {
    const word = settled[i];
    const beginMs = toMs(word.begin);
    if (toMs(word.end) - beginMs < MIN_SETTLED_MS) continue;
    const target = beginMs + shiftTo(beginMs, residue);
    const previous = settled[i - 1];
    const touching = toMs(previous.end) === beginMs;
    if (target < (touching ? toMs(previous.begin) + 1 : toMs(previous.end))) continue;
    word.begin = target / 1000;
    if (touching) previous.end = target / 1000;
  }
  return settled;
}

function withExportTiming(lines: readonly LyricLine[], untouchedIds: ReadonlySet<string>): LyricLine[] {
  return lines.map((line) => {
    const words = timedSyllables(mainTrack(line));
    if (!untouchedIds.has(line.id) || !words.length) return line;
    return withRoleWords(line, "main", settleTrack(words, words.length % RESIDUE));
  });
}

function spanTimesMs(lineBody: string): { begin: number; end: number }[] {
  return [...lineBody.matchAll(SPAN_TIMES)].map(([, begin, end]) => ({
    begin: toMs(parseTtmlTimestamp(begin)),
    end: toMs(parseTtmlTimestamp(end)),
  }));
}

function readExportTiming(ttml: string): ExportTimingReading {
  let markedLines = 0;
  let checkedLines = 0;
  for (const chunk of ttml.split("<p ").slice(1)) {
    const body = chunk.slice(0, chunk.indexOf("</p>"));
    const background = body.indexOf(BACKGROUND_OPEN);
    const spans = spanTimesMs(background === -1 ? body : body.slice(0, background));
    const readable = spans.slice(1).filter((span) => span.end - span.begin >= MIN_READ_SPAN_MS);
    if (readable.length < 2) continue;
    checkedLines++;
    const residue = spans.length % RESIDUE;
    const matched = readable.filter((span) => span.begin % RESIDUE === residue).length;
    if (matched >= 2 && matched >= readable.length * MARKED_SHARE) markedLines++;
  }
  return { markedLines, checkedLines };
}

// -- Exports ------------------------------------------------------------------

export { readExportTiming, withExportTiming };
