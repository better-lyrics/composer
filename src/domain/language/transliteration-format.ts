import type { WordTiming } from "@/domain/word/timing";

const DASHES = /[-\u2010-\u2015]+/g;

interface TimingWordGroup {
  words: WordTiming[];
  startIndex: number;
}

interface TransliterationSlice {
  text: string;
  joinerAfter?: string;
}

/** Display literal separator dashes with the preceding slot's timing, without changing stored mappings. */
function timedTransliterationSlice({ text, joinerAfter = "" }: TransliterationSlice): TransliterationSlice {
  const timedJoiner = /[-\u2010-\u2015]/.test(joinerAfter) ? joinerAfter.trimEnd() : "";
  return { text: text + timedJoiner, joinerAfter: joinerAfter.slice(timedJoiner.length) };
}

interface SeparatorRegion {
  start: number;
  end: number;
}

function normalizeSpaceRun(run: string): string {
  return [...run].length > 1 ? "  " : " ";
}

/** Preserve Composer's visible one-space/two-space reading convention. */
function normalizeTransliterationForEditing(value: string): string {
  return value.replace(/\s+/g, normalizeSpaceRun).trim();
}

/** Double spaces delimit romanized words; single spaces remain inside them. */
function transliterationWordGroups(value: string): string[] {
  const normalized = normalizeTransliterationForEditing(value);
  return normalized ? normalized.split(twoSpaceSeparatorPattern()).filter(Boolean) : [];
}

function twoSpaceSeparatorPattern(): RegExp {
  return / {2}/g;
}

function twoSpaceSeparatorRegions(value: string): SeparatorRegion[] {
  return [...value.matchAll(twoSpaceSeparatorPattern())].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** Visible pronunciation units. These are hints, never timing boundaries. */
function transliterationPronunciationParts(value: string): string[] {
  const normalized = normalizeTransliterationForEditing(value);
  return normalized ? normalized.split(/ +/).filter(Boolean) : [];
}

/** Source spaces are the canonical lexical boundaries, independent of group IDs. */
function timingLexicalWordGroups(words: WordTiming[]): TimingWordGroup[] {
  const result: TimingWordGroup[] = [];
  let startIndex = 0;
  for (let index = 0; index < words.length; index++) {
    if (!words[index].text.endsWith(" ") && index < words.length - 1) continue;
    result.push({ words: words.slice(startIndex, index + 1), startIndex });
    startIndex = index + 1;
  }
  return result;
}

function sourceWordGroups(originalText: string): string[] {
  return originalText.trim().split(/\s+/).filter(Boolean);
}

function sourceWordCount(originalText: string): number {
  return sourceWordGroups(originalText).length;
}

function leadingUntimedSeparator(value: string): string {
  return value.match(/^[-\u2010-\u2015\s]+/)?.[0] ?? "";
}

function trailingUntimedSeparator(value: string): string {
  return value.match(/[-\u2010-\u2015\s]+$/)?.[0] ?? "";
}

function withoutEdgeUntimedSeparators(value: string): string {
  const leading = leadingUntimedSeparator(value);
  const trailing = trailingUntimedSeparator(value.slice(leading.length));
  return value.slice(leading.length, trailing.length > 0 ? value.length - trailing.length : value.length);
}

/**
 * Split visible reading text without consuming spaces or punctuation as timing
 * slots. A separator adjacent to a boundary is restored as its exact joiner.
 */
function splitTransliterationAtBoundaries(
  value: string,
  boundaries: number[],
  { preserveEdgeDashes = false }: { preserveEdgeDashes?: boolean } = {},
): TransliterationSlice[] {
  const points = boundaries.toSorted((a, b) => a - b);
  const raw: string[] = [];
  let start = 0;
  for (const point of points) {
    if (point < start || point > value.length) continue;
    raw.push(value.slice(start, point));
    start = point;
  }
  raw.push(value.slice(start));

  return raw.map((part, index) => {
    const leading = leadingUntimedSeparator(part);
    const trailing = trailingUntimedSeparator(part);
    const contentEnd = trailing.length > 0 ? part.length - trailing.length : part.length;
    // The alignment editor works on already-visible text, including dashes
    // imported inside timed spans. Keep those edges without changing preprocessing.
    const prefix = preserveEdgeDashes && index === 0 ? leading.trimStart() : "";
    const suffix =
      preserveEdgeDashes && index === raw.length - 1 && !(index === 0 && leading.length === part.length)
        ? trailing.trimEnd()
        : "";
    const text = prefix + part.slice(leading.length, contentEnd) + suffix;
    if (index === raw.length - 1) return { text };
    const nextLeading = leadingUntimedSeparator(raw[index + 1]);
    return { text, joinerAfter: trailing + nextLeading };
  });
}

function hasLexicalBoundaryAfter(words: WordTiming[], index: number): boolean {
  return index < words.length - 1 && words[index].text.endsWith(" ");
}

export {
  DASHES,
  hasLexicalBoundaryAfter,
  leadingUntimedSeparator,
  normalizeTransliterationForEditing,
  sourceWordCount,
  splitTransliterationAtBoundaries,
  timedTransliterationSlice,
  timingLexicalWordGroups,
  trailingUntimedSeparator,
  transliterationPronunciationParts,
  transliterationWordGroups,
  twoSpaceSeparatorRegions,
  withoutEdgeUntimedSeparators,
};
export type { TransliterationSlice };
