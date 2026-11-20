import { lineTransliteration, withLanguages } from "@/domain/language/line-languages";
import type {
  BackgroundLanguage,
  LanguagePieces,
  LanguageSide,
  LineLanguage,
  TransliterationAlignmentStatus,
} from "@/domain/language/model";
import { mappedTransliteration, slicedPieces, trackPieces } from "@/domain/language/pieces";
import { withPiecesOn, withSidePieces, withTrackPieces } from "@/domain/language/side-pieces";
import {
  normalizeTransliterationForEditing,
  sourceWordCount,
  splitTransliterationAtBoundaries,
  timingLexicalWordGroups,
  transliterationWordGroups,
  twoSpaceSeparatorRegions,
} from "@/domain/language/transliteration-format";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { roleWords } from "@/domain/line/track";
import { spacedText } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";

interface TransliterationAlignmentPlan {
  pieces: LanguagePieces | undefined;
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

function planTransliterationAlignment(
  words: WordTiming[],
  pieces: LanguagePieces | undefined,
  rawText: string,
  previousStatus?: TransliterationAlignmentStatus,
): TransliterationAlignmentPlan {
  const text = normalizeTransliterationForEditing(rawText);
  if (!text) {
    return { pieces: undefined, status: "inferred" };
  }
  if (words.length === 0) return { pieces, status: "inferred" };

  const existing = mappedTransliteration(words, pieces);
  if (existing !== null && normalizeTransliterationForEditing(existing) === text) {
    // Matching text preserves the mapping, but does not constitute manual review.
    return {
      pieces,
      status: previousStatus === "confirmed" || previousStatus === "needs-review" ? previousStatus : "inferred",
    };
  }

  const lexicalGroups = timingLexicalWordGroups(words);
  const groupWeights = lexicalGroups.map((group) => group.words.reduce((sum, word) => sum + [...word.text].length, 0));
  const grouped = groupRegions(text, lexicalGroups.length, groupWeights);
  if (!grouped) {
    return {
      pieces,
      status: "unresolved",
      message: "This transliteration doesn't match the timed syllables.",
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
      group.words.map((word) => [...word.text].length),
    );
    if (!local) {
      return {
        pieces,
        status: "unresolved",
        message: `Word ${groupIndex + 1} has more timed syllables than the transliteration has parts.`,
      };
    }
    exact &&= local.exact;
    allBoundaries.push(...local.boundaries.map((boundary) => region.start + boundary));
    if (groupIndex < lexicalGroups.length - 1) allBoundaries.push(grouped.regions[groupIndex + 1].start);
  }

  const slices = splitTransliterationAtBoundaries(text, allBoundaries);
  if (slices.length !== words.length) {
    return { pieces, status: "unresolved", message: "Some syllables have no transliteration yet." };
  }
  return {
    pieces: slicedPieces(words, slices, pieces),
    status: exact ? "inferred" : "needs-review",
  };
}

function timedPrefixText(originalText: string, words: WordTiming[], text: string): string {
  const sourceCount = sourceWordCount(originalText);
  const timedCount = sourceWordCount(spacedText(words));
  if (timedCount >= sourceCount) return text;
  const groups = transliterationWordGroups(text);
  return groups.length === sourceCount ? groups.slice(0, timedCount).join("  ") : text;
}

function validateTransliterationAlignment(
  _originalText: string,
  transliteration: string,
  words?: WordTiming[],
  pieces?: LanguagePieces,
): string | null {
  if (!transliteration.trim() || !words?.length) return null;
  const plan = planTransliterationAlignment(words, pieces, transliteration);
  return plan.status === "unresolved" ? (plan.message ?? "Press Align to match this to the timing.") : null;
}

interface SideSource {
  text: string;
  words: WordTiming[] | undefined;
}

function sideSource(line: LyricLine, side: LanguageSide): SideSource {
  return side === "main"
    ? { text: lineText(line), words: roleWords(line, "main") }
    : { text: backgroundText(line) ?? "", words: roleWords(line, "bg") };
}

function sidePlan(
  line: LyricLine,
  side: LanguageSide,
  track: BackgroundLanguage | undefined,
  status?: TransliterationAlignmentStatus,
): TransliterationAlignmentPlan | null {
  const { text, words } = sideSource(line, side);
  if (!words?.length) return null;
  const pieces = trackPieces(line, side);
  return planTransliterationAlignment(words, pieces, timedPrefixText(text, words, track?.text ?? ""), status);
}

function withPlannedPieces(
  language: LineLanguage,
  side: LanguageSide,
  plan: TransliterationAlignmentPlan | null,
): LineLanguage {
  return plan ? withTrackPieces(language, side, plan.pieces) : language;
}

function withAlignedTransliteration(line: LyricLine): LyricLine {
  const track = lineTransliteration(line);
  if (!track) return line;
  const main = withPlannedPieces(track, "main", sidePlan(line, "main", track.main));
  const aligned = withPlannedPieces(main, "bg", sidePlan(line, "bg", track.bg));
  return aligned === track ? line : { ...line, ...withLanguages(line, { transliteration: aligned }) };
}

function sameReading(a: BackgroundLanguage | undefined, b: BackgroundLanguage | undefined): boolean {
  return normalizeTransliterationForEditing(a?.text ?? "") === normalizeTransliterationForEditing(b?.text ?? "");
}

// Regeneration and text edits may build a fresh track object. When its reading
// is unchanged, retain the old mapping's review state rather than laundering
// an estimated mapping through the existing-fragments shortcut.
function sidePlanKeepingReview(
  line: LyricLine,
  sideTrack: BackgroundLanguage | undefined,
  side: LanguageSide,
): TransliterationAlignmentPlan | null {
  const current = lineTransliteration(line)?.[side];
  const status = sideTrack?.alignmentStatus ?? (sameReading(current, sideTrack) ? current?.alignmentStatus : undefined);
  return sidePlan(line, side, sideTrack, status);
}

function alignedSide<T extends BackgroundLanguage>(
  sideTrack: T,
  plan: TransliterationAlignmentPlan | null,
  alignmentStatus: TransliterationAlignmentStatus | undefined,
): T {
  return { ...withSidePieces(sideTrack, plan ? plan.pieces : sideTrack.pieces), alignmentStatus };
}

function alignTrackToLine(line: LyricLine, track: LineLanguage): Pick<LyricLine, "languages"> {
  const mainPlan = sidePlanKeepingReview(line, track.main, "main");
  const main = alignedSide(track.main, mainPlan, mainPlan?.status ?? "inferred");
  const bgPlan = sidePlanKeepingReview(line, track.bg, "bg");
  const bg = track.bg && alignedSide(track.bg, bgPlan, track.bg.text ? (bgPlan?.status ?? "inferred") : undefined);
  const { bg: _bg, ...rest } = track;
  const { languages } = withLanguages(line, { transliteration: { ...rest, main, ...(bg && { bg }) } });
  const planned = mainPlan ? withPiecesOn(languages, "main", mainPlan.pieces) : languages;
  return { languages: bgPlan && !bg ? withPiecesOn(planned, "bg", bgPlan.pieces) : planned };
}

function withAlignedWords(line: LyricLine): LyricLine {
  const track = lineTransliteration(line);
  return track ? { ...line, ...alignTrackToLine(line, track) } : line;
}

export {
  alignTrackToLine,
  planTransliterationAlignment,
  validateTransliterationAlignment,
  withAlignedTransliteration,
  withAlignedWords,
};
