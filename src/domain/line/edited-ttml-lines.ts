import type { Part } from "insync/part";
import type { DocPassthrough } from "insync/passthrough";
import { mergedLanguages } from "@/domain/line/edited-ttml-languages";
import { pairEditedLines } from "@/domain/line/edited-ttml-pairing";
import { hasKeptData, withKeptDataOf } from "@/domain/line/edited-ttml-passthrough";
import { fieldsOfLine, type LineFields, lineFromFields, untimedRest } from "@/domain/line/line-from-fields";
import type { LyricLine } from "insync/line";
import { withoutKeptData } from "@/domain/line/passthrough";
import { isSyncableLine } from "@/domain/line/sync-progress";
import { trackText } from "@/domain/line/text";
import { backgroundTrack } from "insync/line-track";
import { withBackgroundTrack, withoutTrackTiming, withTrackText } from "@/domain/line/track-writes";
import { withUntimedIdsOf } from "@/domain/line/untimed-ids";
import type { WordTiming } from "insync/word-timing";
import { formatTime } from "@/utils/format-time";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { generateLineTtml } from "@/utils/ttml";
import { type LineKeyIds, lineKeyIds } from "@/utils/ttml-line-keys";
import { withoutSplitCharacter } from "@/utils/split-character-text";

// -- Types ------------------------------------------------------------------

interface EditedTtmlLines {
  lines: readonly LyricLine[];
  lineKeys?: readonly (string | undefined)[];
  parts?: readonly Part[];
  passthrough?: DocPassthrough;
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

// A line-synced background exports as one span; the edit's one span moves it and keeps it line synced.
function keptBackgroundSpan(stored: LineFields, edited: LineFields): Partial<LineFields> | null {
  const [span, ...rest] = edited.backgroundWords ?? [];
  if (stored.backgroundBegin === undefined || !span || rest.length > 0) return null;
  const same = sameExportedTime(span.begin, stored.backgroundBegin) && sameExportedTime(span.end, stored.backgroundEnd);
  const source = stored.backgroundText === edited.backgroundText ? stored.backgroundTextSource : undefined;
  return {
    backgroundTextSource: source,
    backgroundWords: undefined,
    backgroundBegin: same ? stored.backgroundBegin : span.begin,
    backgroundEnd: same ? stored.backgroundEnd : span.end,
    backgroundExplicit: span.explicit,
  };
}

function mergedBackground(stored: LineFields, edited: LineFields): Partial<LineFields> {
  const span = keptBackgroundSpan(stored, edited);
  if (span) return span;
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

function withoutSeededBackground(line: LyricLine, splitChar: string): LyricLine {
  const background = backgroundTrack(line);
  if (!background || !hasSeededBackgroundWords(undefined, fieldsOfLine(line, splitChar))) return line;
  return withBackgroundTrack(
    line,
    withTrackText(withoutTrackTiming(background), trackText(background, splitChar), splitChar),
  );
}

function mergedTiming(stored: LineFields, edited: LineFields): Pick<LineFields, "words" | "begin" | "end"> {
  if (edited.words) return { words: mergedWords(stored.words, edited.words) ?? edited.words };
  const keepsBounds =
    !stored.words && sameExportedTime(stored.begin, edited.begin) && sameExportedTime(stored.end, edited.end);
  return keepsBounds ? { begin: stored.begin, end: stored.end } : { begin: edited.begin, end: edited.end };
}

// An export writes only timed syllables, so the stored untimed rest is never part of an edit: it follows whatever the
// edited words spell. A file that spells the rest itself, timed or not, keeps its own, and a timed word the file
// dropped stays dropped.
function withStoredRest(
  edited: string,
  words: readonly WordTiming[],
  stored: string,
  splitChar: string,
  storedWords: WordTiming[] = [],
): string {
  if (untimedRest(edited, words, splitChar) !== "") return edited;
  const afterEdited = untimedRest(stored, words, splitChar);
  const untimed = untimedRest(stored, storedWords, splitChar);
  const rest = afterEdited.length <= untimed.length ? afterEdited : untimed;
  return rest === "" ? edited : edited.trimEnd() + rest;
}

function mergedText(stored: LineFields, edited: LineFields, splitChar: string): string {
  if (edited.words) return withStoredRest(edited.text, edited.words, stored.text, splitChar, stored.words);
  return edited.text === withoutSplitCharacter(stored.text, splitChar) ? stored.text : edited.text;
}

function mergedBackgroundText(stored: LineFields, edited: LineFields, splitChar: string): string | undefined {
  const { backgroundText, backgroundWords } = edited;
  if (backgroundText === undefined || !backgroundWords || stored.backgroundText === undefined) return backgroundText;
  return withStoredRest(backgroundText, backgroundWords, stored.backgroundText, splitChar, stored.backgroundWords);
}

function fieldMergedLine(storedLine: LyricLine, editedLine: LyricLine, splitChar: string): LyricLine {
  const stored = fieldsOfLine(storedLine, splitChar);
  const edited = fieldsOfLine(editedLine, splitChar);
  const { languages: _languages, ...editedFields } = edited;
  const background = mergedBackground(stored, edited);
  const timing = mergedTiming(stored, edited);
  const languages = mergedLanguages(storedLine, editedLine, {
    words: timing.words,
    backgroundWords: background.backgroundWords,
  });
  const merged = lineFromFields(
    {
      ...editedFields,
      text: mergedText(stored, edited, splitChar),
      backgroundText: mergedBackgroundText(stored, edited, splitChar),
      ...background,
      ...timing,
      id: stored.id,
      ...(languages ? { languages } : {}),
    },
    splitChar,
  );
  return withKeptDataOf(withUntimedIdsOf(merged, storedLine), editedLine, splitChar);
}

// A line whose only change is its kept TTML data keeps everything else as stored.
function mergedLine(stored: LyricLine, edited: LyricLine, splitChar: string): LyricLine {
  if (generateLineTtml(stored, splitChar) === generateLineTtml(edited, splitChar)) return stored;
  if (!hasKeptData(stored) && !hasKeptData(edited)) return fieldMergedLine(stored, edited, splitChar);
  return generateLineTtml(withoutKeptData(stored), splitChar) === generateLineTtml(withoutKeptData(edited), splitChar)
    ? withKeptDataOf(stored, edited, splitChar)
    : fieldMergedLine(stored, edited, splitChar);
}

// -- Merge --------------------------------------------------------------------

function skippedLinesAfter(
  stored: readonly LyricLine[],
  kept: ReadonlySet<LyricLine>,
  splitChar: string,
): Map<LyricLine | undefined, LyricLine[]> {
  const skippedAfter = new Map<LyricLine | undefined, LyricLine[]>();
  let anchor: LyricLine | undefined;
  for (const line of stored) {
    if (kept.has(line)) anchor = line;
    else if (!isSyncableLine(line, splitChar)) skippedAfter.set(anchor, [...(skippedAfter.get(anchor) ?? []), line]);
  }
  return skippedAfter;
}

function pairedWithStored(stored: readonly LyricLine[], edit: EditedTtmlLines, splitChar: string) {
  return pairEditedLines(stored, edit.lines, editedKeys(edit), lineKeyIds(stored, splitChar), splitChar);
}

function editedKeys(edit: EditedTtmlLines): (string | undefined)[] {
  return edit.lines.map((_, index) => edit.lineKeys?.[index]);
}

function mergeEditedTtmlLines(stored: readonly LyricLine[], edit: EditedTtmlLines, splitChar: string): LyricLine[] {
  const { lines: edited, partners } = pairedWithStored(stored, edit, splitChar);
  const skippedAfter = skippedLinesAfter(
    stored,
    new Set(partners.filter((partner) => partner !== undefined)),
    splitChar,
  );
  const merged = [...(skippedAfter.get(undefined) ?? [])];
  edited.forEach((line, index) => {
    const partner = partners[index];
    merged.push(partner ? mergedLine(partner, line, splitChar) : withoutSeededBackground(line, splitChar));
    if (partner) merged.push(...(skippedAfter.get(partner) ?? []));
  });
  return merged;
}

function mergedLineIdsByKey(stored: readonly LyricLine[], edit: EditedTtmlLines, splitChar: string): LineKeyIds {
  const { lines, partners } = pairedWithStored(stored, edit, splitChar);
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

// Each edited line's id, and the id it has after the merge: its stored partner's, or its own when it has none.
function mergedLineIds(stored: readonly LyricLine[], edit: EditedTtmlLines, splitChar: string): Map<string, string> {
  const { partners } = pairedWithStored(stored, edit, splitChar);
  return new Map(edit.lines.map((line, index) => [line.id, partners[index]?.id ?? line.id] as const));
}

// Kept times go stale once a line moves and the export writes derived ones instead, so kept data never decides.
function holdsEveryLine(stored: readonly LyricLine[], ownExport: readonly LyricLine[], splitChar: string): boolean {
  const exported = stored.filter((value) => isSyncableLine(value, splitChar));
  return (
    exported.length === ownExport.length &&
    exported.every((line, index) => {
      const form = ownExport[index];
      return (
        form !== undefined &&
        isStructurallyEqual(withoutKeptData(fieldMergedLine(line, form, splitChar)), withoutKeptData(line))
      );
    })
  );
}

// -- Exports ------------------------------------------------------------------

export type { EditedTtmlLines };
export { holdsEveryLine, mergedLineIds, mergedLineIdsByKey, mergeEditedTtmlLines };
