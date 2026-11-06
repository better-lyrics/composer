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
const SPAN_BEGIN = /<span begin="(\d+):(\d+)\.(\d{3})"/g;

// -- Functions ----------------------------------------------------------------

function toMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

function shiftTo(ms: number, residue: number): number {
  return ((residue - (ms % RESIDUE) + RESIDUE + MAX_SHIFT_MS) % RESIDUE) - MAX_SHIFT_MS;
}

// Must match the spans generateTTML writes for a line, so a reader can recompute the residue.
function exportedSpanCount(line: LyricLine): number {
  const main = line.words?.length ?? 0;
  const background = line.backgroundText ? Math.max(line.backgroundWords?.length ?? 0, 1) : 0;
  return main + background;
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
    word.begin = target / 1000;
    if (touching) touching.end = target / 1000;
  }
  return stamped;
}

function watermarkLines(lines: readonly LyricLine[], untouchedIds: ReadonlySet<string>): LyricLine[] {
  return lines.map((line) => {
    if (!untouchedIds.has(line.id) || !line.words?.length) return line;
    const residue = exportedSpanCount(line) % RESIDUE;
    const background = line.backgroundWords?.length
      ? { backgroundWords: stampTrack(line.backgroundWords, residue) }
      : {};
    return { ...line, words: stampTrack(line.words, residue), ...background };
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
    const begins = spanBeginsMs(chunk.slice(0, chunk.indexOf("</p>")));
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
