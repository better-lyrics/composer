// -- Types --------------------------------------------------------------------

type HeardRange = [number, number];

interface Span {
  begin: number;
  end: number;
}

// -- Constants ----------------------------------------------------------------

const UPDATE_TOLERANCE_SECONDS = 0.5;

// -- Functions ----------------------------------------------------------------

function mergeRanges(ranges: readonly HeardRange[]): HeardRange[] {
  const merged: HeardRange[] = [];
  for (const [start, end] of ranges.toSorted((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function withoutSpan(ranges: readonly HeardRange[], span: Span): HeardRange[] {
  return ranges.flatMap(([start, end]) => {
    if (span.end <= start || span.begin >= end) return [[start, end]];
    const pieces: HeardRange[] = [];
    if (start < span.begin) pieces.push([start, span.begin]);
    if (span.end < end) pieces.push([span.end, end]);
    return pieces;
  });
}

function withoutSpans(ranges: readonly HeardRange[], spans: readonly Span[]): HeardRange[] {
  return spans.reduce<HeardRange[]>((kept, span) => withoutSpan(kept, span), [...ranges]);
}

function coversSpan(ranges: readonly HeardRange[], begin: number, end: number): boolean {
  return ranges.some(
    ([start, stop]) => start <= begin + UPDATE_TOLERANCE_SECONDS && stop >= end - UPDATE_TOLERANCE_SECONDS,
  );
}

function isHeardRange(value: unknown): value is HeardRange {
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

function readHeardRanges(value: unknown): HeardRange[] {
  return Array.isArray(value) ? value.filter(isHeardRange) : [];
}

// -- Exports ------------------------------------------------------------------

export { coversSpan, mergeRanges, readHeardRanges, withoutSpans };
export type { HeardRange };
