import type { TranslationTracks, TransliterationTrack } from "@/domain/language/model";
import { mainBounds } from "@/domain/line/bounds";
import { pairEditedLines } from "@/domain/line/edited-ttml-pairing";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { isSyncableLine } from "@/domain/line/sync-progress";
import type { WordTiming } from "@/domain/word/timing";
import { formatTime } from "@/utils/format-time";
import { stripSplitCharacter } from "@/utils/split-character";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { generateLineTtml } from "@/utils/ttml";
import { hasAlternateText } from "@/utils/ttml-alternate-content";
import { type LineKeyIds, lineKeyIds } from "@/utils/ttml-line-keys";

// -- Types ------------------------------------------------------------------

interface EditedTtmlLines {
  lines: readonly LyricLine[];
  lineKeys?: readonly (string | undefined)[];
}

// -- Comparison ---------------------------------------------------------------

function sameExportedTime(a: number | undefined, b: number | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && formatTime(a) === formatTime(b));
}

function exportedWordText(words: readonly WordTiming[], index: number): string {
  const text = words[index]?.text ?? "";
  return index < words.length - 1 ? text : text.trimEnd();
}

function sameExportedWord(stored: readonly WordTiming[], edited: readonly WordTiming[], index: number): boolean {
  const word = stored[index];
  const other = edited[index];
  return (
    word !== undefined &&
    other !== undefined &&
    exportedWordText(stored, index) === exportedWordText(edited, index) &&
    !!word.explicit === !!other.explicit &&
    sameExportedTime(word.begin, other.begin) &&
    sameExportedTime(word.end, other.end)
  );
}

function sameWordSpacing(stored: readonly WordTiming[], edited: readonly WordTiming[]): boolean {
  return (
    stored.length === edited.length &&
    stored.every(
      (word, index) => index === stored.length - 1 || word.text.endsWith(" ") === edited[index]?.text.endsWith(" "),
    )
  );
}

function inSyllableGroupOf(word: WordTiming, stored: WordTiming): WordTiming {
  const { syllableGroupId: _inferred, ...rest } = word;
  return stored.syllableGroupId === undefined ? rest : { ...rest, syllableGroupId: stored.syllableGroupId };
}

function mergedWords(stored: WordTiming[] | undefined, edited: WordTiming[] | undefined): WordTiming[] | undefined {
  if (!stored || !edited || !sameWordSpacing(stored, edited)) return edited;
  if (stored.every((_, index) => sameExportedWord(stored, edited, index))) return stored;
  return edited.map((word, index) => {
    const kept = stored[index];
    if (!kept) return word;
    return sameExportedWord(stored, edited, index) ? kept : inSyllableGroupOf(word, kept);
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
  if (stored.backgroundText !== edited.backgroundText) {
    return { backgroundWords: seeded ? undefined : mergedWords(storedWords, edited.backgroundWords) };
  }
  if (seeded) return { backgroundTextSource: stored.backgroundTextSource, backgroundWords: storedWords };
  return {
    backgroundTextSource: stored.backgroundTextSource,
    backgroundWords: mergedWords(storedWords, edited.backgroundWords),
  };
}

function withoutSeededBackground(line: LyricLine): LyricLine {
  if (!hasSeededBackgroundWords(undefined, line)) return line;
  const { backgroundWords: _seeded, ...rest } = line;
  return rest;
}

function mergedTiming(stored: LyricLine, edited: LyricLine): Pick<LyricLine, "words" | "begin" | "end"> {
  if (edited.words) return { words: mergedWords(stored.words, edited.words) ?? edited.words };
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

// -- Merge --------------------------------------------------------------------

function isOutsideEdit(line: LyricLine, knownIds: ReadonlySet<string>): boolean {
  return !isSyncableLine(line) || !knownIds.has(line.id);
}

function linesOutsideEdit(stored: readonly LyricLine[], keyIds: LineKeyIds): LyricLine[] {
  const knownIds = new Set(Object.values(keyIds));
  return stored.filter((line) => isOutsideEdit(line, knownIds));
}

function skippedLinesAfter(
  stored: readonly LyricLine[],
  kept: ReadonlySet<LyricLine>,
  keyIds: LineKeyIds,
): Map<LyricLine | undefined, LyricLine[]> {
  const outside = new Set(linesOutsideEdit(stored, keyIds));
  const skippedAfter = new Map<LyricLine | undefined, LyricLine[]>();
  let anchor: LyricLine | undefined;
  for (const line of stored) {
    if (kept.has(line)) anchor = line;
    else if (outside.has(line)) skippedAfter.set(anchor, [...(skippedAfter.get(anchor) ?? []), line]);
  }
  return skippedAfter;
}

function mergeEditedTtmlLines(
  stored: readonly LyricLine[],
  edit: EditedTtmlLines,
  keyIds: LineKeyIds = lineKeyIds(stored),
): LyricLine[] {
  const { lines: edited, partners } = pairEditedLines(
    stored,
    edit.lines,
    edit.lines.map((_, index) => edit.lineKeys?.[index]),
    keyIds,
  );
  const skippedAfter = skippedLinesAfter(stored, new Set(partners.filter((partner) => partner !== undefined)), keyIds);
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

export { holdsEveryLine, linesOutsideEdit, mergeEditedTtmlLines };
