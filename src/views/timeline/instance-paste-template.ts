import { type LineTemplate, offsetTemplateWords, type WordTemplate } from "insync/group-template";
import type { LinkGroup } from "insync/group";
import { pickedTemplateSource } from "insync/group-template-source";
import type { LyricLine } from "insync/line";
import type { WordTrack } from "insync/line-track";
import { wordFromSpaced } from "insync/word-spaced-words";
import { instanceToTemplate } from "@/views/timeline/group-ops";
import type { ClipboardData, ClipboardEntry } from "@/views/timeline/selection-types";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types ---------------------------------------------------------------------

type SourceInstance = NonNullable<ClipboardData["sourceInstance"]>;

// -- Functions -----------------------------------------------------------------

function instancePasteTemplate(
  lines: LyricLine[],
  groups: readonly LinkGroup[],
  { groupId, instanceIdx }: SourceInstance,
): LineTemplate[] {
  const group = groups.find((candidate) => candidate.id === groupId);
  return instanceToTemplate(lines, groupId, pickedTemplateSource(lines, group, instanceIdx, getSplitCharacter()));
}

function trackEntries(words: WordTemplate[] | undefined, lineOffset: number, trackType: WordTrack): ClipboardEntry[] {
  return offsetTemplateWords(words ?? [], 0).map((word, index) => {
    const piece = words?.[index].piece;
    return { word, lineOffset, trackType, ...(piece && { piece }) };
  });
}

function templateEntries(line: LineTemplate, lineOffset: number): ClipboardEntry[] {
  const main = trackEntries(line.words, lineOffset, "word");
  const entries: ClipboardEntry[] = [...main, ...trackEntries(line.backgroundWords, lineOffset, "bg")];
  if (main.length === 0 && line.relativeBegin !== undefined && line.relativeEnd !== undefined)
    entries.push({
      word: wordFromSpaced({ text: line.text, begin: line.relativeBegin, end: line.relativeEnd }),
      lineOffset,
      trackType: "word",
    });
  return entries;
}

// Relative to the instance start; a line-synced main line can start before it when background words set the start.
function instancePasteClipboard(lines: LyricLine[], groups: readonly LinkGroup[], clipboard: ClipboardData) {
  if (!clipboard.sourceInstance) return clipboard;
  const entries = instancePasteTemplate(lines, groups, clipboard.sourceInstance)
    .flatMap(templateEntries)
    .toSorted((a, b) => a.word.begin - b.word.begin);
  return entries.length > 0 ? { ...clipboard, entries } : clipboard;
}

// -- Exports -------------------------------------------------------------------

export { instancePasteClipboard, instancePasteTemplate };
