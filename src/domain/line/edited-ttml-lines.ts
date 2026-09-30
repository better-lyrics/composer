import type { TranslationTracks, TransliterationTrack } from "@/domain/language/model";
import { mainBounds } from "@/domain/line/bounds";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";
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
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergedTransliteration(stored: LyricLine, edited: LyricLine): TransliterationTrack | undefined {
  const kept = stored.transliteration;
  const track = edited.transliteration;
  if (!track) return kept && !hasAlternateText(kept) ? kept : undefined;
  return kept && kept.language === track.language && sameAlternateText(kept, track) ? kept : track;
}

function hasSeededBackgroundWords(stored: LyricLine, edited: LyricLine): boolean {
  const words = edited.backgroundWords;
  const bounds = mainBounds(edited);
  return (
    !stored.backgroundWords?.length &&
    words?.length === 1 &&
    bounds !== null &&
    sameExportedTime(words[0]?.begin, bounds.begin) &&
    sameExportedTime(words[0]?.end, bounds.end)
  );
}

function mergedBackground(stored: LyricLine, edited: LyricLine): Partial<LyricLine> {
  if (stored.backgroundText !== edited.backgroundText) {
    return hasSeededBackgroundWords(stored, edited) ? { backgroundWords: undefined } : {};
  }
  const storedWords = stored.backgroundWords;
  return {
    backgroundTextSource: stored.backgroundTextSource,
    backgroundWords: storedWords?.length
      ? sameExportedWords(storedWords, edited.backgroundWords)
        ? storedWords
        : edited.backgroundWords
      : undefined,
  };
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

function storedPartners(stored: readonly LyricLine[], edited: readonly LyricLine[]): (LyricLine | undefined)[] {
  const exported = stored.filter(isSyncableLine);
  if (exported.length === edited.length) return [...exported];
  const unused = new Set(exported);
  return edited.map((line) => {
    const text = stripSplitCharacter(line.text);
    const match = exported.find((candidate) => unused.has(candidate) && stripSplitCharacter(candidate.text) === text);
    if (match) unused.delete(match);
    return match;
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
    merged.push(partner ? mergedLine(partner, line) : line);
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
