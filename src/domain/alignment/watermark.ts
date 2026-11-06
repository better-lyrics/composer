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
const SPAN_BEGIN = /<span begin="(\d+):(\d+)\.(\d{3})"/g;

// -- Functions ----------------------------------------------------------------

function toMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

function shiftTo(ms: number, residue: number): number {
  return ((residue - (ms % RESIDUE) + RESIDUE + MAX_SHIFT_MS) % RESIDUE) - MAX_SHIFT_MS;
}

function stampTrack(words: readonly WordTiming[], residue: number): WordTiming[] {
  const stamped = words.map((word) => ({ ...word }));
  for (let i = 0; i < stamped.length; i++) {
    const word = stamped[i];
    const beginMs = toMs(word.begin);
    if (toMs(word.end) - beginMs < MIN_STAMPED_MS) continue;
    const target = beginMs + shiftTo(beginMs, residue);
    const previous = i > 0 ? stamped[i - 1] : undefined;
    const touching = previous !== undefined && toMs(previous.end) === beginMs ? previous : undefined;
    if (target < 0 || (touching && target <= toMs(touching.begin))) continue;
    if (previous && !touching && target < toMs(previous.end)) continue;
    word.begin = target / 1000;
    if (touching) touching.end = target / 1000;
  }
  return stamped;
}

function watermarkLines(lines: readonly LyricLine[], untouchedIds: ReadonlySet<string>): LyricLine[] {
  return lines.map((line) => {
    if (!untouchedIds.has(line.id) || !line.words?.length) return line;
    return { ...line, words: stampTrack(line.words, line.words.length % RESIDUE) };
  });
}

function spanBeginsMs(lineBody: string): number[] {
  return [...lineBody.matchAll(SPAN_BEGIN)].map(
    ([, minutes, seconds, ms]) => Number(minutes) * 60000 + Number(seconds) * 1000 + Number(ms),
  );
}

function readWatermark(ttml: string): WatermarkReading {
  let markedLines = 0;
  let checkedLines = 0;
  for (const chunk of ttml.split("<p ").slice(1)) {
    const body = chunk.slice(0, chunk.indexOf("</p>"));
    const background = body.indexOf(BACKGROUND_OPEN);
    const begins = spanBeginsMs(background === -1 ? body : body.slice(0, background));
    if (begins.length < 2) continue;
    checkedLines++;
    const residue = begins.length % RESIDUE;
    const matched = begins.filter((ms) => ms % RESIDUE === residue).length;
    if (matched >= 2 && matched >= begins.length * MARKED_SHARE) markedLines++;
  }
  return { markedLines, checkedLines };
}

// -- Exports ------------------------------------------------------------------

export { readWatermark, watermarkLines };
