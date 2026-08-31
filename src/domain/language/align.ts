import type { TransliterationAlignmentStatus, TransliterationTrack } from "@/domain/language/model";
import {
  hasLexicalBoundaryAfter,
  normalizeTransliterationForEditing,
  sourceWordCount,
  splitTransliterationAtBoundaries,
  timingLexicalWordGroups,
  transliterationWordGroups,
  twoSpaceSeparatorRegions,
} from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

interface TransliterationAlignmentPlan {
  words: WordTiming[];
  status: TransliterationAlignmentStatus;
  message?: string;
}

interface TextRegion {
  start: number;
  end: number;
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function graphemeBoundaries(value: string): number[] {
  return [...GRAPHEME_SEGMENTER.segment(value)].map((item) => item.index).slice(1);
}

function separatorRuns(value: string): TextRegion[] {
  return [...value.matchAll(/[-\u2010-\u2015\s]+/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function visibleGraphemeBoundaries(value: string): number[] {
  const separators = separatorRuns(value);
  return graphemeBoundaries(value).filter(
    (boundary) => !separators.some((separator) => boundary > separator.start && boundary < separator.end),
  );
}

function inferredBoundaries(value: string, slotWeights: number[]): { boundaries: number[]; exact: boolean } | null {
  if (slotWeights.length <= 1) return { boundaries: [], exact: true };
  const separators = separatorRuns(value).filter((run) => run.start > 0 && run.end < value.length);
  if (separators.length === slotWeights.length - 1) {
    return { boundaries: separators.map((run) => run.end), exact: true };
  }

  const candidates = visibleGraphemeBoundaries(value);
  if (candidates.length < slotWeights.length - 1) return null;
  const totalWeight = slotWeights.reduce((sum, weight) => sum + Math.max(1, weight), 0);
  let consumedWeight = 0;
  let previous = 0;
  const boundaries: number[] = [];
  for (let index = 0; index < slotWeights.length - 1; index++) {
    consumedWeight += Math.max(1, slotWeights[index]);
    const ideal = Math.round((consumedWeight / totalWeight) * value.length);
    const available = candidates.filter((candidate) => candidate > previous);
    if (available.length === 0) return null;
    const remaining = slotWeights.length - index - 2;
    const usable = available.slice(0, Math.max(1, available.length - remaining));
    let selected = usable.reduce((best, candidate) =>
      Math.abs(candidate - ideal) < Math.abs(best - ideal) ? candidate : best,
    );
    const adjacentSeparator = separators.find((separator) => separator.start <= selected && separator.end >= selected);
    if (adjacentSeparator) selected = adjacentSeparator.end;
    boundaries.push(selected);
    previous = selected;
  }
  return { boundaries, exact: false };
}

function legacyJoiner(words: WordTiming[], index: number): string {
  return words[index].transliterationJoinerAfter ?? (hasLexicalBoundaryAfter(words, index) ? "  " : " ");
}

function mappedTransliteration(words: WordTiming[]): string | null {
  if (!words.length || words.some((word) => word.transliteration === undefined)) return null;
  return words
    .map((word, index) => `${word.transliteration}${index < words.length - 1 ? legacyJoiner(words, index) : ""}`)
    .join("");
}

function applySlices(words: WordTiming[], slices: ReturnType<typeof splitTransliterationAtBoundaries>): WordTiming[] {
  return words.map((word, index) => ({
    ...word,
    transliteration: slices[index]?.text ?? "",
    ...(index < words.length - 1 ? { transliterationJoinerAfter: slices[index]?.joinerAfter ?? "" } : {}),
  }));
}

function groupRegions(
  text: string,
  groupCount: number,
  weights: number[],
): { regions: TextRegion[]; exact: boolean } | null {
  if (groupCount === 1) return { regions: [{ start: 0, end: text.length }], exact: true };
  const wordSeparators = twoSpaceSeparatorRegions(text);
  if (wordSeparators.length === groupCount - 1) {
    const regions: TextRegion[] = [];
    let start = 0;
    for (const separator of wordSeparators) {
      regions.push({ start, end: separator.start });
      start = separator.end;
    }
    regions.push({ start, end: text.length });
    return { regions, exact: true };
  }

  const inferred = inferredBoundaries(text, weights);
  if (!inferred || inferred.boundaries.length !== groupCount - 1) return null;
  const slices = splitTransliterationAtBoundaries(text, inferred.boundaries);
  const regions: TextRegion[] = [];
  let cursor = 0;
  for (const slice of slices) {
    const start = text.indexOf(slice.text, cursor);
    if (start < 0) return null;
    regions.push({ start, end: start + slice.text.length });
    cursor = start + slice.text.length + (slice.joinerAfter?.length ?? 0);
  }
  return { regions, exact: false };
}

function planTransliterationAlignment(words: WordTiming[], rawText: string): TransliterationAlignmentPlan {
  const text = normalizeTransliterationForEditing(rawText);
  if (!text || words.length === 0) return { words, status: "confirmed" };

  const existing = mappedTransliteration(words);
  if (existing !== null && normalizeTransliterationForEditing(existing) === text) {
    return { words, status: "confirmed" };
  }

  const lexicalGroups = timingLexicalWordGroups(words);
  const groupWeights = lexicalGroups.map((group) =>
    group.words.reduce((sum, word) => sum + [...word.text.trimEnd()].length, 0),
  );
  const grouped = groupRegions(text, lexicalGroups.length, groupWeights);
  if (!grouped) {
    return {
      words,
      status: "unresolved",
      message: "Composer could not map this transliteration to the original timed words.",
    };
  }

  const allBoundaries: number[] = [];
  let exact = grouped.exact;
  for (let groupIndex = 0; groupIndex < lexicalGroups.length; groupIndex++) {
    const group = lexicalGroups[groupIndex];
    const region = grouped.regions[groupIndex];
    const localText = text.slice(region.start, region.end);
    const local = inferredBoundaries(
      localText,
      group.words.map((word) => [...word.text.trimEnd()].length),
    );
    if (!local) {
      return {
        words,
        status: "unresolved",
        message: `Original word ${groupIndex + 1} has more timed parts than its transliteration can safely map.`,
      };
    }
    exact &&= local.exact;
    allBoundaries.push(...local.boundaries.map((boundary) => region.start + boundary));
    if (groupIndex < lexicalGroups.length - 1) allBoundaries.push(grouped.regions[groupIndex + 1].start);
  }

  const slices = splitTransliterationAtBoundaries(text, allBoundaries);
  if (slices.length !== words.length) {
    return { words, status: "unresolved", message: "The inferred transliteration mapping is incomplete." };
  }
  return {
    words: applySlices(words, slices),
    status: exact ? "inferred" : "needs-review",
  };
}

function timedPrefixText(originalText: string, words: WordTiming[], text: string): string {
  const sourceCount = sourceWordCount(originalText);
  const timedCount = timingLexicalWordGroups(words).length;
  if (timedCount >= sourceCount) return text;
  const groups = transliterationWordGroups(text);
  return groups.length === sourceCount ? groups.slice(0, timedCount).join("  ") : text;
}

function validateTransliterationAlignment(
  _originalText: string,
  transliteration: string,
  words?: WordTiming[],
): string | null {
  if (!transliteration.trim() || !words?.length) return null;
  const plan = planTransliterationAlignment(words, transliteration);
  return plan.status === "unresolved" ? (plan.message ?? "This transliteration needs a timing alignment.") : null;
}

function withAlignedTransliteration(line: LyricLine): LyricLine {
  const track = line.transliteration;
  if (!track) return line;
  return {
    ...line,
    ...(line.words
      ? { words: planTransliterationAlignment(line.words, timedPrefixText(line.text, line.words, track.text)).words }
      : {}),
    ...(line.backgroundWords && track.backgroundText
      ? {
          backgroundWords: planTransliterationAlignment(
            line.backgroundWords,
            timedPrefixText(line.backgroundText ?? "", line.backgroundWords, track.backgroundText),
          ).words,
        }
      : {}),
  } as LyricLine;
}

function alignTrackToLine(line: LyricLine, track: TransliterationTrack): Partial<LyricLine> {
  const main = line.words?.length
    ? planTransliterationAlignment(line.words, timedPrefixText(line.text, line.words, track.text))
    : null;
  const background =
    line.backgroundWords?.length && track.backgroundText
      ? planTransliterationAlignment(
          line.backgroundWords,
          timedPrefixText(line.backgroundText ?? "", line.backgroundWords, track.backgroundText),
        )
      : null;
  return {
    transliteration: {
      ...track,
      alignmentStatus: main?.status ?? "confirmed",
      ...(track.backgroundText ? { backgroundAlignmentStatus: background?.status ?? "confirmed" } : {}),
    },
    ...(main ? { words: main.words } : {}),
    ...(background ? { backgroundWords: background.words } : {}),
  };
}

export {
  alignTrackToLine,
  mappedTransliteration,
  planTransliterationAlignment,
  validateTransliterationAlignment,
  withAlignedTransliteration,
};
