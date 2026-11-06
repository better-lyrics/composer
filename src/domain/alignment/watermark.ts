import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface WatermarkReading {
  markedLines: number;
  checkedLines: number;
}

// -- Constants ----------------------------------------------------------------

const RESIDUE = 7;
const MAX_SHIFT_MS = 3;
const MIN_STAMPED_MS = 7;
const MARKED_SHARE = 0.75;
const BACKGROUND_OPEN = '<span ttm:role="x-bg"';
const SPAN_TIMES = /<span begin="(\d+):(\d+)\.(\d{3})" end="(\d+):(\d+)\.(\d{3})"/g;
const MIN_READ_SPAN_MS = MIN_STAMPED_MS + 2 * MAX_SHIFT_MS;

// -- Functions ----------------------------------------------------------------

function toMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

function shiftTo(ms: number, residue: number): number {
  return ((residue - (ms % RESIDUE) + RESIDUE + MAX_SHIFT_MS) % RESIDUE) - MAX_SHIFT_MS;
}

function stampTrack(words: readonly WordTiming[], residue: number): WordTiming[] {
  const stamped = words.map((word) => ({ ...word }));
  for (let i = 1; i < stamped.length; i++) {
    const word = stamped[i];
    const beginMs = toMs(word.begin);
    if (toMs(word.end) - beginMs < MIN_STAMPED_MS) continue;
    const target = beginMs + shiftTo(beginMs, residue);
    const previous = stamped[i - 1];
    const touching = toMs(previous.end) === beginMs;
    if (target < (touching ? toMs(previous.begin) + 1 : toMs(previous.end))) continue;
    word.begin = target / 1000;
    if (touching) previous.end = target / 1000;
  }
  return stamped;
}

function watermarkLines(lines: readonly LyricLine[], untouchedIds: ReadonlySet<string>): LyricLine[] {
  return lines.map((line) => {
    if (!untouchedIds.has(line.id) || !line.words?.length) return line;
    return { ...line, words: stampTrack(line.words, line.words.length % RESIDUE) };
  });
}

function clockMs(minutes: string, seconds: string, ms: string): number {
  return Number(minutes) * 60000 + Number(seconds) * 1000 + Number(ms);
}

function spanTimesMs(lineBody: string): { begin: number; end: number }[] {
  return [...lineBody.matchAll(SPAN_TIMES)].map(([, bm, bs, bms, em, es, ems]) => ({
    begin: clockMs(bm, bs, bms),
    end: clockMs(em, es, ems),
  }));
}

function readWatermark(ttml: string): WatermarkReading {
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

export { readWatermark, watermarkLines };
