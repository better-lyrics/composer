import { type LineTemplate, type LinkGroup, offsetTemplateWords } from "@/domain/group/template";
import { pickedTemplateSource } from "@/domain/group/template-source";
import type { LyricLine } from "@/domain/line/model";
import { instanceToTemplate } from "@/views/timeline/group-ops";
import type { ClipboardData, ClipboardEntry } from "@/views/timeline/selection-types";

// -- Types ---------------------------------------------------------------------

type SourceInstance = NonNullable<ClipboardData["sourceInstance"]>;

// -- Functions -----------------------------------------------------------------

function instancePasteTemplate(
  lines: LyricLine[],
  groups: readonly LinkGroup[],
  { groupId, instanceIdx }: SourceInstance,
): LineTemplate[] {
  const group = groups.find((candidate) => candidate.id === groupId);
  return instanceToTemplate(lines, groupId, pickedTemplateSource(lines, group, instanceIdx));
}

function templateEntries(line: LineTemplate, lineOffset: number): ClipboardEntry[] {
  const main = offsetTemplateWords(line.words ?? [], 0);
  const background = offsetTemplateWords(line.backgroundWords ?? [], 0);
  const entries: ClipboardEntry[] = [
    ...main.map((word) => ({ word, lineOffset, trackType: "word" as const })),
    ...background.map((word) => ({ word, lineOffset, trackType: "bg" as const })),
  ];
  if (main.length === 0 && line.relativeBegin !== undefined && line.relativeEnd !== undefined)
    entries.push({
      word: { text: line.text, begin: line.relativeBegin, end: line.relativeEnd },
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
