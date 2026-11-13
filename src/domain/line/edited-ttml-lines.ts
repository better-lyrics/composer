import { mergedLanguages } from "@/domain/line/edited-ttml-languages";
import { pairEditedLines } from "@/domain/line/edited-ttml-pairing";
import { type LineFields, fieldsOfLine, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack } from "@/domain/line/track";
import { trackText } from "@/domain/line/text";
import { withBackgroundTrack, withoutTrackTiming, withTrackText } from "@/domain/line/track-writes";
import { withUntimedIdsOf } from "@/domain/line/untimed-ids";
import { isSyncableLine } from "@/domain/line/sync-progress";
import type { WordTiming } from "@/domain/word/timing";
import { formatTime } from "@/utils/format-time";
import { stripSplitCharacter } from "@/utils/split-character";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { generateLineTtml } from "@/utils/ttml";
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
  const word = words[index];
  if (!word) return "";
  return index < words.length - 1 ? word.text + word.sep : word.text;
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
      (word, index) => index === stored.length - 1 || word.sep.endsWith(" ") === edited[index]?.sep.endsWith(" "),
    )
  );
}

function inSyllableGroupOf(word: WordTiming, stored: WordTiming): WordTiming {
  return { ...word, joinsNext: stored.joinsNext };
}

function mergedWords(stored: WordTiming[] | undefined, edited: WordTiming[] | undefined): WordTiming[] | undefined {
  if (!stored || !edited || !sameWordSpacing(stored, edited)) return edited;
  if (stored.every((_, index) => sameExportedWord(stored, edited, index))) return stored;
  return edited.map((word, index) => {
    const kept = stored[index];
    if (!kept) return word;
    return sameExportedWord(stored, edited, index) ? kept : { ...inSyllableGroupOf(word, kept), id: kept.id };
  });
}

// -- Field merges -------------------------------------------------------------

function hasSeededBackgroundWords(storedWords: readonly WordTiming[] | undefined, edited: LineFields): boolean {
  const words = edited.backgroundWords;
  const bounds = edited.words?.length
    ? { begin: edited.words[0].begin, end: edited.words[edited.words.length - 1].end }
    : edited.begin !== undefined && edited.end !== undefined
      ? { begin: edited.begin, end: edited.end }
      : null;
  return (
    !storedWords?.length &&
    words?.length === 1 &&
    bounds !== null &&
    sameExportedTime(words[0]?.begin, bounds.begin) &&
    sameExportedTime(words[0]?.end, bounds.end)
  );
}

function mergedBackground(stored: LineFields, edited: LineFields): Partial<LineFields> {
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
  const background = backgroundTrack(line);
  if (!background || !hasSeededBackgroundWords(undefined, fieldsOfLine(line))) return line;
  return withBackgroundTrack(line, withTrackText(withoutTrackTiming(background), trackText(background)));
}

function mergedTiming(stored: LineFields, edited: LineFields): Pick<LineFields, "words" | "begin" | "end"> {
  if (edited.words) return { words: mergedWords(stored.words, edited.words) ?? edited.words };
  const keepsBounds =
    !stored.words && sameExportedTime(stored.begin, edited.begin) && sameExportedTime(stored.end, edited.end);
  return keepsBounds ? { begin: stored.begin, end: stored.end } : { begin: edited.begin, end: edited.end };
}

function mergedText(stored: LineFields, edited: LineFields): string {
  return !edited.words && edited.text === stripSplitCharacter(stored.text) ? stored.text : edited.text;
}

function fieldMergedLine(storedLine: LyricLine, editedLine: LyricLine): LyricLine {
  const stored = fieldsOfLine(storedLine);
  const edited = fieldsOfLine(editedLine);
  const { languages: _languages, ...editedFields } = edited;
  const background = mergedBackground(stored, edited);
  const timing = mergedTiming(stored, edited);
  const languages = mergedLanguages(storedLine, editedLine, {
    words: timing.words,
    backgroundWords: background.backgroundWords,
  });
  const merged = lineFromFields({
    ...editedFields,
    text: mergedText(stored, edited),
    ...background,
    ...timing,
    id: stored.id,
    ...(languages ? { languages } : {}),
  });
  return withUntimedIdsOf(merged, storedLine);
}

function mergedLine(stored: LyricLine, edited: LyricLine): LyricLine {
  return generateLineTtml(stored) === generateLineTtml(edited) ? stored : fieldMergedLine(stored, edited);
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

function pairedWithStored(stored: readonly LyricLine[], edit: EditedTtmlLines) {
  return pairEditedLines(stored, edit.lines, editedKeys(edit), lineKeyIds(stored));
}

function editedKeys(edit: EditedTtmlLines): (string | undefined)[] {
  return edit.lines.map((_, index) => edit.lineKeys?.[index]);
}

function mergeEditedTtmlLines(stored: readonly LyricLine[], edit: EditedTtmlLines): LyricLine[] {
  const { lines: edited, partners } = pairedWithStored(stored, edit);
  const skippedAfter = skippedLinesAfter(stored, new Set(partners.filter((partner) => partner !== undefined)));
  const merged = [...(skippedAfter.get(undefined) ?? [])];
  edited.forEach((line, index) => {
    const partner = partners[index];
    merged.push(partner ? mergedLine(partner, line) : withoutSeededBackground(line));
    if (partner) merged.push(...(skippedAfter.get(partner) ?? []));
  });
  return merged;
}

function mergedLineIdsByKey(stored: readonly LyricLine[], edit: EditedTtmlLines): LineKeyIds {
  const { lines, partners } = pairedWithStored(stored, edit);
  const keys = editedKeys(edit);
  const ids: Record<string, string> = {};
  lines.forEach((line, index) => {
    const key = keys[index];
    if (key === undefined) return;
    const partner = partners[index];
    if (partner) ids[key] = partner.id;
    else if (!(key in ids)) ids[key] = line.id;
  });
  return ids;
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

export { holdsEveryLine, mergeEditedTtmlLines, mergedLineIdsByKey };
