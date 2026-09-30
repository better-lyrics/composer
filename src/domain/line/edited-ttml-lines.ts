import type { TranslationTracks, TransliterationTrack } from "@/domain/language/model";
import { mainBounds } from "@/domain/line/bounds";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";
import { lcsPairs, wordKey } from "@/domain/word/alignment";
import type { WordTiming } from "@/domain/word/timing";
import { formatTime } from "@/utils/format-time";
import { stripSplitCharacter } from "@/utils/split-character";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { generateLineTtml } from "@/utils/ttml";
import { hasAlternateText } from "@/utils/ttml-alternate-content";

// -- Comparison ---------------------------------------------------------------

function sameExportedTime(a: number | undefined, b: number | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && formatTime(a) === formatTime(b));
}

function sameExportedWords(
  stored: readonly WordTiming[] | undefined,
  edited: readonly WordTiming[] | undefined,
): boolean {
  if (!stored || !edited || stored.length !== edited.length) return false;
  return stored.every((word, index) => {
    const other = edited[index];
    return (
      other !== undefined &&
      word.text === other.text &&
      !!word.explicit === !!other.explicit &&
      sameExportedTime(word.begin, other.begin) &&
      sameExportedTime(word.end, other.end)
    );
  });
}

function sameAlternateText(
  stored: { text: string; backgroundText?: string } | undefined,
  edited: { text: string; backgroundText?: string } | undefined,
): boolean {
  return (
    stored !== undefined &&
    edited !== undefined &&
    stored.text === edited.text &&
    (stored.backgroundText ?? "") === (edited.backgroundText ?? "")
  );
}

// -- Field merges -------------------------------------------------------------

function mergedTranslations(stored: LyricLine, edited: LyricLine): TranslationTracks | undefined {
  const merged: TranslationTracks = {};
  for (const [language, track] of Object.entries(stored.translations ?? {})) {
    if (!hasAlternateText(track) && !edited.translations?.[language]) merged[language] = track;
  }
  for (const [language, track] of Object.entries(edited.translations ?? {})) {
    const kept = stored.translations?.[language];
    merged[language] = kept && sameAlternateText(kept, track) ? kept : track;
  }
  if (Object.keys(merged).length > 0) return merged;
  return stored.translations && Object.keys(stored.translations).length === 0 ? stored.translations : undefined;
}

function mergedTransliteration(stored: LyricLine, edited: LyricLine): TransliterationTrack | undefined {
  const kept = stored.transliteration;
  const track = edited.transliteration;
  if (!track) return kept && !hasAlternateText(kept) ? kept : undefined;
  return kept && kept.language === track.language && sameAlternateText(kept, track) ? kept : track;
}

function hasSeededBackgroundWords(storedWords: readonly WordTiming[] | undefined, edited: LyricLine): boolean {
  const words = edited.backgroundWords;
  const bounds = mainBounds(edited);
  return (
    !storedWords?.length &&
    words?.length === 1 &&
    bounds !== null &&
    sameExportedTime(words[0]?.begin, bounds.begin) &&
    sameExportedTime(words[0]?.end, bounds.end)
  );
}

function mergedBackground(stored: LyricLine, edited: LyricLine): Partial<LyricLine> {
  const storedWords = stored.backgroundWords;
  const seeded = hasSeededBackgroundWords(storedWords, edited);
  if (stored.backgroundText !== edited.backgroundText) return seeded ? { backgroundWords: undefined } : {};
  if (seeded) return { backgroundTextSource: stored.backgroundTextSource, backgroundWords: storedWords };
  return {
    backgroundTextSource: stored.backgroundTextSource,
    backgroundWords: sameExportedWords(storedWords, edited.backgroundWords) ? storedWords : edited.backgroundWords,
  };
}

function withoutSeededBackground(line: LyricLine): LyricLine {
  if (!hasSeededBackgroundWords(undefined, line)) return line;
  const { backgroundWords: _seeded, ...rest } = line;
  return rest;
}

function mergedTiming(stored: LyricLine, edited: LyricLine): Pick<LyricLine, "words" | "begin" | "end"> {
  if (edited.words) return { words: sameExportedWords(stored.words, edited.words) ? stored.words : edited.words };
  const keepsBounds =
    !stored.words && sameExportedTime(stored.begin, edited.begin) && sameExportedTime(stored.end, edited.end);
  return keepsBounds ? { begin: stored.begin, end: stored.end } : { begin: edited.begin, end: edited.end };
}

function mergedText(stored: LyricLine, edited: LyricLine): string {
  return !edited.words && edited.text === stripSplitCharacter(stored.text) ? stored.text : edited.text;
}

function fieldMergedLine(stored: LyricLine, edited: LyricLine): LyricLine {
  const { translations: _translations, transliteration: _transliteration, ...editedFields } = edited;
  const translations = mergedTranslations(stored, edited);
  const transliteration = mergedTransliteration(stored, edited);
  return reconcileLine({
    ...editedFields,
    text: mergedText(stored, edited),
    ...mergedBackground(stored, edited),
    ...mergedTiming(stored, edited),
    id: stored.id,
    ...(translations ? { translations } : {}),
    ...(transliteration ? { transliteration } : {}),
  });
}

function mergedLine(stored: LyricLine, edited: LyricLine): LyricLine {
  return generateLineTtml(stored) === generateLineTtml(edited) ? stored : fieldMergedLine(stored, edited);
}

// -- Pairing ------------------------------------------------------------------

function indexesBetween(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start - 1) }, (_, offset) => start + 1 + offset);
}

function storedPartners(stored: readonly LyricLine[], edited: readonly LyricLine[]): (LyricLine | undefined)[] {
  const exported = stored.filter(isSyncableLine);
  const storedKeys = exported.map((line) => wordKey(line.text));
  const editedKeys = edited.map((line) => wordKey(line.text));
  const partnerIndex = new Map<number, number>();
  const paired = new Set<number>();
  const pair = (editedIndex: number, storedIndex: number) => {
    partnerIndex.set(editedIndex, storedIndex);
    paired.add(storedIndex);
  };
  const anchors = lcsPairs(storedKeys, editedKeys);
  for (const [storedIndex, editedIndex] of anchors) pair(editedIndex, storedIndex);
  editedKeys.forEach((key, editedIndex) => {
    if (partnerIndex.has(editedIndex)) return;
    const moved = storedKeys.findIndex((storedKey, storedIndex) => !paired.has(storedIndex) && storedKey === key);
    if (moved >= 0) pair(editedIndex, moved);
  });
  const bounds: [number, number][] = [[-1, -1], ...anchors, [exported.length, edited.length]];
  bounds.slice(1).forEach(([storedEnd, editedEnd], gap) => {
    const [storedStart, editedStart] = bounds[gap] ?? [-1, -1];
    const freeStored = indexesBetween(storedStart, storedEnd).filter((index) => !paired.has(index));
    const freeEdited = indexesBetween(editedStart, editedEnd).filter((index) => !partnerIndex.has(index));
    freeEdited.forEach((editedIndex, offset) => {
      const storedIndex = freeStored[offset];
      if (storedIndex !== undefined) pair(editedIndex, storedIndex);
    });
  });
  return edited.map((_, editedIndex) => {
    const storedIndex = partnerIndex.get(editedIndex);
    return storedIndex === undefined ? undefined : exported[storedIndex];
  });
}

// -- Merge --------------------------------------------------------------------

function skippedLinesAfter(
  stored: readonly LyricLine[],
  kept: ReadonlySet<LyricLine>,
): Map<LyricLine | undefined, LyricLine[]> {
  const skippedAfter = new Map<LyricLine | undefined, LyricLine[]>();
  let anchor: LyricLine | undefined;
  for (const line of stored) {
    if (kept.has(line)) anchor = line;
    else if (!isSyncableLine(line)) skippedAfter.set(anchor, [...(skippedAfter.get(anchor) ?? []), line]);
  }
  return skippedAfter;
}

function mergeEditedTtmlLines(stored: readonly LyricLine[], edited: readonly LyricLine[]): LyricLine[] {
  const partners = storedPartners(stored, edited);
  const skippedAfter = skippedLinesAfter(stored, new Set(partners.filter((partner) => partner !== undefined)));
  const merged = [...(skippedAfter.get(undefined) ?? [])];
  edited.forEach((line, index) => {
    const partner = partners[index];
    merged.push(partner ? mergedLine(partner, line) : withoutSeededBackground(line));
    if (partner) merged.push(...(skippedAfter.get(partner) ?? []));
  });
  return merged;
}

function holdsEveryLine(stored: readonly LyricLine[], ownExport: readonly LyricLine[]): boolean {
  const exported = stored.filter(isSyncableLine);
  return (
    exported.length === ownExport.length &&
    exported.every((line, index) => {
      const form = ownExport[index];
      return form !== undefined && isStructurallyEqual(fieldMergedLine(line, form), line);
    })
  );
}

// -- Exports ------------------------------------------------------------------

export { holdsEveryLine, mergeEditedTtmlLines };
