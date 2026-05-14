import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// -- Types ---------------------------------------------------------------------

interface ExplicitSnippet {
  before: string;
  word: string;
  after: string;
  leadingEllipsis: boolean;
  trailingEllipsis: boolean;
}

// -- Helpers -------------------------------------------------------------------

function findWordCharRange(source: string, wordIndex: number): { start: number; end: number } | null {
  const { parts } = splitIntoWordsWithMeta(source);
  if (wordIndex < 0 || wordIndex >= parts.length) return null;
  let cursor = 0;
  for (let i = 0; i < parts.length; i++) {
    const start = source.indexOf(parts[i], cursor);
    if (start === -1) return null;
    const end = start + parts[i].length;
    if (i === wordIndex) return { start, end };
    cursor = end;
  }
  return null;
}

function getExplicitSnippet(source: string, wordIndex: number, max: number): ExplicitSnippet | null {
  const range = findWordCharRange(source, wordIndex);
  if (!range) return null;
  const { start, end } = range;
  const wordLen = end - start;

  if (source.length <= max || wordLen >= max) {
    return {
      before: source.slice(0, start),
      word: source.slice(start, end),
      after: source.slice(end),
      leadingEllipsis: false,
      trailingEllipsis: false,
    };
  }

  const remaining = max - wordLen;
  const beforeBudget = Math.floor(remaining * 0.35);
  const afterBudget = remaining - beforeBudget;

  let beforeStart = Math.max(0, start - beforeBudget);
  let afterEnd = Math.min(source.length, end + afterBudget);

  if (beforeStart === 0) {
    const usedBefore = start;
    const extra = beforeBudget - usedBefore;
    afterEnd = Math.min(source.length, afterEnd + extra);
  }
  if (afterEnd === source.length) {
    const usedAfter = source.length - end;
    const extra = afterBudget - usedAfter;
    beforeStart = Math.max(0, beforeStart - extra);
  }

  return {
    before: source.slice(beforeStart, start),
    word: source.slice(start, end),
    after: source.slice(end, afterEnd),
    leadingEllipsis: beforeStart > 0,
    trailingEllipsis: afterEnd < source.length,
  };
}

// -- Exports -------------------------------------------------------------------

export { getExplicitSnippet };
