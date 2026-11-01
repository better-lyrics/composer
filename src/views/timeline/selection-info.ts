import { effectiveTrackWords, type ReadableLine } from "@/domain/line/effective-words";
import type { LinkGroup } from "@/domain/group/template";
import { instanceCount, instanceOrdinal } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordSelection } from "@/domain/selection/model";
import type { WordTiming } from "@/domain/word/timing";
import { pluralize } from "@/utils/pluralize";

// -- Types --------------------------------------------------------------------

interface GroupHighlight {
  accentColor: string;
  label: string;
}

interface MultiSelectionSummary {
  wordCount: number;
  lineCount: number;
  begin: number;
  end: number;
}

// -- Helpers ------------------------------------------------------------------

function selectedWord(selection: WordSelection, lines: readonly ReadableLine[]): WordTiming | undefined {
  const line = lines[selection.lineIndex];
  return line ? effectiveTrackWords(line, selection.type)?.[selection.wordIndex] : undefined;
}

// -- Functions ----------------------------------------------------------------

function selectionGroupHighlight(
  selection: readonly WordSelection[],
  rawLines: readonly LyricLine[],
  groups: readonly LinkGroup[],
): GroupHighlight | null {
  const rawLinesById = new Map(rawLines.map((l) => [l.id, l] as const));
  const instances = new Set<number>();
  let groupId: string | undefined;
  for (const sel of selection) {
    const line = rawLinesById.get(sel.lineId);
    if (!line?.groupId || line.instanceIdx === undefined) return null;
    if (groupId !== undefined && line.groupId !== groupId) return null;
    groupId = line.groupId;
    instances.add(line.instanceIdx);
  }
  const group = groups.find((g) => g.id === groupId);
  if (groupId === undefined || !group) return null;
  const [onlyInstance] = instances;
  const label =
    instances.size === 1
      ? `${group.label} · ${instanceOrdinal(rawLines, groupId, onlyInstance)} of ${instanceCount(rawLines, groupId)}`
      : `${group.label} · ${instances.size} instances`;
  return { accentColor: group.color, label };
}

function selectedWordTiming(
  selection: WordSelection,
  lines: readonly ReadableLine[],
): Pick<WordTiming, "text" | "begin" | "end"> | null {
  const word = selectedWord(selection, lines);
  return word ? { text: word.text, begin: word.begin, end: word.end } : null;
}

function multiSelectionSummary(
  selection: readonly WordSelection[],
  lines: readonly ReadableLine[],
  rawLines: readonly LyricLine[],
): MultiSelectionSummary | null {
  if (selection.length <= 1) return null;
  const rawLinesById = new Map(rawLines.map((l) => [l.id, l] as const));
  const countedLineIds = new Set<string>();
  let begin = Number.POSITIVE_INFINITY;
  let end = 0;
  for (const sel of selection) {
    const word = selectedWord(sel, lines);
    if (!word) continue;
    begin = Math.min(begin, word.begin);
    end = Math.max(end, word.end);
    const raw = sel.type === "word" ? rawLinesById.get(sel.lineId) : undefined;
    if (raw && isLineSynced(raw)) countedLineIds.add(raw.id);
  }
  if (begin === Number.POSITIVE_INFINITY) return null;
  const lineCount = countedLineIds.size;
  return { wordCount: selection.length - lineCount, lineCount, begin, end };
}

function selectionCountLabel(wordCount: number, lineCount: number): string {
  const parts = [
    wordCount > 0 || lineCount === 0 ? pluralize(wordCount, "word") : null,
    lineCount > 0 ? pluralize(lineCount, "line") : null,
  ].filter((part) => part !== null);
  return `${parts.join(", ")} selected`;
}

// -- Exports ------------------------------------------------------------------

export { multiSelectionSummary, selectedWordTiming, selectionCountLabel, selectionGroupHighlight };
export type { GroupHighlight, MultiSelectionSummary };
