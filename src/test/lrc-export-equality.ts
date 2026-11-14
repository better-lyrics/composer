import { LRC_CLOCK, parseLrcClock } from "@/utils/lyrics-parsers/lrc";

// -- Types --------------------------------------------------------------------

interface LrcTag {
  // Where the tag sits in the line's text with every tag removed.
  at: number;
  inline: boolean;
  ms: number;
}

interface LrcComparison {
  textDiffers: boolean;
  unmatchedTags: { line: number; tag: LrcTag }[];
  overTolerance: { line: number; before: number; after: number }[];
  // Values that moved by more than 1 ms and at most one centisecond.
  tolerated: number;
  // Inline tags on one side only, at the time of the word tag beside them.
  extraTags: number;
}

// -- Constants ----------------------------------------------------------------

// LRC prints centiseconds, so a sub-millisecond change can move a printed value by one tick.
const LRC_TOLERANCE_MS = 10;
const LRC_TAG = new RegExp(String.raw`([\[<])${LRC_CLOCK}[\]>]`, "g");

// -- Parsing ------------------------------------------------------------------

function parseLrcLine(line: string): { text: string; tags: LrcTag[] } {
  let text = "";
  let cursor = 0;
  const tags: LrcTag[] = [];
  for (const match of line.matchAll(LRC_TAG)) {
    text += line.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const seconds = parseLrcClock(match[2], match[3], match[4]) ?? Number.NaN;
    tags.push({ at: text.length, inline: match[1] === "<", ms: Math.round(seconds * 1000) });
  }
  return { text: text + line.slice(cursor), tags };
}

// -- Comparison ---------------------------------------------------------------

// The one accepted layout change: an inline tag that repeats the time of the tag before or after it.
function isRepeatedInlineTag(tags: readonly LrcTag[], index: number): boolean {
  const { inline, ms } = tags[index];
  return inline && (tags[index - 1]?.ms === ms || tags[index + 1]?.ms === ms);
}

// At most one extra tag per line, and only an inline one repeating its neighbour's time.
function compareLine(before: LrcTag[], after: LrcTag[], line: number, result: LrcComparison): void {
  let i = 0;
  let j = 0;
  const repeated: LrcTag[] = [];
  const extra = (tags: LrcTag[], index: number) => {
    if (isRepeatedInlineTag(tags, index)) repeated.push(tags[index]);
    else result.unmatchedTags.push({ line, tag: tags[index] });
  };
  while (i < before.length || j < after.length) {
    const a = before[i];
    const b = after[j];
    if (a && b && a.at === b.at && a.inline === b.inline) {
      const moved = Math.abs(a.ms - b.ms);
      if (moved > LRC_TOLERANCE_MS) result.overTolerance.push({ line, before: a.ms, after: b.ms });
      else if (moved > 1) result.tolerated++;
      i++;
      j++;
    } else if (!b || (a && (a.at < b.at || (a.at === b.at && !a.inline)))) {
      extra(before, i++);
    } else {
      extra(after, j++);
    }
  }
  result.extraTags += repeated.length;
  if (repeated.length > 1) result.unmatchedTags.push(...repeated.map((tag) => ({ line, tag })));
}

// Same text on every line; tags paired by place within their line, each within one centisecond.
function compareLrc(before: string, after: string): LrcComparison {
  const was = before.split("\n").map(parseLrcLine);
  const now = after.split("\n").map(parseLrcLine);
  const result: LrcComparison = {
    textDiffers: was.length !== now.length,
    unmatchedTags: [],
    overTolerance: [],
    tolerated: 0,
    extraTags: 0,
  };
  was.forEach((line, index) => {
    const other = now[index];
    if (!other || other.text !== line.text) {
      result.textDiffers = true;
      return;
    }
    compareLine(line.tags, other.tags, index + 1, result);
  });
  return result;
}

// -- Exports ------------------------------------------------------------------

export type { LrcComparison };
export { compareLrc };
