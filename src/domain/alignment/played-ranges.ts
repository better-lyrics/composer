// -- Types --------------------------------------------------------------------

type PlayedRange = [number, number];

interface Span {
  begin: number;
  end: number;
}

// -- Constants ----------------------------------------------------------------

const UPDATE_TOLERANCE_SECONDS = 0.5;

// -- Functions ----------------------------------------------------------------

function mergeRanges(ranges: readonly PlayedRange[]): PlayedRange[] {
  const merged: PlayedRange[] = [];
  for (const [start, end] of ranges.toSorted((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function withoutSpan(ranges: readonly PlayedRange[], span: Span): PlayedRange[] {
  return ranges.flatMap(([start, end]) => {
    if (span.end <= start || span.begin >= end) return [[start, end]];
    const pieces: PlayedRange[] = [];
    if (start < span.begin) pieces.push([start, span.begin]);
    if (span.end < end) pieces.push([span.end, end]);
    return pieces;
  });
}

function withoutSpans(ranges: readonly PlayedRange[], spans: readonly Span[]): PlayedRange[] {
  return spans.reduce<PlayedRange[]>((kept, span) => withoutSpan(kept, span), [...ranges]);
}

function coversSpan(ranges: readonly PlayedRange[], begin: number, end: number): boolean {
  const edge = Math.min(UPDATE_TOLERANCE_SECONDS, (end - begin) / 4);
  let runStart = Number.NEGATIVE_INFINITY;
  let reach = Number.NEGATIVE_INFINITY;
  for (const [start, stop] of ranges.toSorted((a, b) => a[0] - b[0])) {
    if (start > reach + UPDATE_TOLERANCE_SECONDS) runStart = start;
    reach = Math.max(reach, stop);
    if (runStart <= begin + edge && reach >= end - edge) return true;
  }
  return false;
}

function isPlayedRange(value: unknown): value is PlayedRange {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[0] < value[1]
  );
}

function readPlayedRanges(value: unknown): PlayedRange[] {
  return Array.isArray(value) ? value.filter(isPlayedRange) : [];
}

// -- Exports ------------------------------------------------------------------

export type { PlayedRange };
export { coversSpan, mergeRanges, readPlayedRanges, withoutSpans };
