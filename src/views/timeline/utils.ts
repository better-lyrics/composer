import { drawnSyllables } from "insync/line-drawn-track";
import { lineInstanceKey } from "insync/instance-key";
import type { LyricLine } from "insync/line";
import { lineText } from "insync/line-text";
import { mainTrack, trackRole } from "insync/line-track";
import { withMainTrack, withTrackSyllables } from "insync/line-track-writes";
import type { ResolvedAddress } from "@/domain/selection/resolve";
import { formatTime as formatTimeBase } from "insync/format-time";
import { distributeWordsInLine } from "insync/lyric-words";
import { type GroupFocus, effectiveFocus, isInFocus } from "@/views/timeline/group-focus";
import { lineRowHeight } from "@/views/timeline/row-geometry";
import { getSplitCharacter } from "@/utils/split-character";

// -- Functions -----------------------------------------------------------------

// Distributed lines are word-synced: each line's syllables share its slice of the song by length.
function distributeLinesTiming(lines: readonly LyricLine[], duration: number): LyricLine[] {
  if (lines.length === 0) return [];

  const lineDuration = duration / lines.length;

  return lines.map((line, index) => {
    const begin = index * lineDuration;
    const end = (index + 1) * lineDuration;
    const distributed = distributeWordsInLine(lineText(line, getSplitCharacter()), begin, end, getSplitCharacter());
    const syllables = mainTrack(line).syllables;
    const words =
      distributed.length === syllables.length
        ? distributed.map((word, i) => ({ ...syllables[i], begin: word.begin, end: word.end }))
        : distributed;
    return withMainTrack(line, withTrackSyllables(mainTrack(line), words));
  });
}

const formatTime = (seconds: number) => formatTimeBase(seconds, 2);

function getWordsInInstance(lines: readonly LyricLine[], groupId: string, instanceIdx: number): ResolvedAddress[] {
  const out: ResolvedAddress[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (line.groupId !== groupId || line.instanceIdx !== instanceIdx) continue;
    for (const type of ["word", "bg"] as const) {
      drawnSyllables(line, trackRole(type), getSplitCharacter()).forEach((word, wordIndex) => {
        out.push({ lineId: line.id, type, syllableId: word.id, lineIndex, wordIndex });
      });
    }
  }
  return out;
}

interface RowLayoutInput {
  lines: LyricLine[];
  rowHeights: Record<string, number>;
  defaultRowHeight: number;
  collapsedInstances: Record<string, boolean>;
  focusedGroup: GroupFocus | null;
  waveformHeight: number;
  groupHeaderHeight: number;
}

interface HeaderPosition {
  top: number;
  height: number;
}

interface RowPosition extends HeaderPosition {
  mainBottom: number;
}

interface RowLayout {
  lineTops: Map<string, RowPosition>;
  headerTops: Map<string, HeaderPosition>;
}

function computeRowLayout({
  lines,
  rowHeights,
  defaultRowHeight,
  collapsedInstances,
  focusedGroup,
  waveformHeight,
  groupHeaderHeight,
}: RowLayoutInput): RowLayout {
  const lineTops = new Map<string, RowPosition>();
  const headerTops = new Map<string, HeaderPosition>();
  let rowTop = waveformHeight;
  let lastInstanceKey: string | null = null;
  const shownFocus = effectiveFocus(lines, focusedGroup);

  for (const line of lines) {
    if (!isInFocus(line, shownFocus)) continue;
    const inst = shownFocus === null ? lineInstanceKey(line) : null;

    if (inst !== lastInstanceKey && inst !== null) {
      headerTops.set(inst, { top: rowTop, height: groupHeaderHeight });
      rowTop += groupHeaderHeight;
    }
    lastInstanceKey = inst;

    const isCollapsed = inst !== null && collapsedInstances[inst];
    if (isCollapsed) continue;

    const mainHeight = rowHeights[line.id] ?? defaultRowHeight;
    const rowHeight = lineRowHeight(line, mainHeight);
    lineTops.set(line.id, { top: rowTop, height: rowHeight, mainBottom: rowTop + mainHeight });
    rowTop += rowHeight;
  }

  return { lineTops, headerTops };
}

// -- Hit testing ---------------------------------------------------------------

function getLineIndexAtY(y: number, lines: LyricLine[], layout: RowLayout): number {
  for (let i = 0; i < lines.length; i++) {
    const pos = layout.lineTops.get(lines[i].id);
    if (!pos) continue;
    if (y >= pos.top && y < pos.top + pos.height) return i;
  }
  return -1;
}

function getLineAndTrackAtY(
  y: number,
  lines: LyricLine[],
  layout: RowLayout,
): { lineIndex: number; track: "word" | "bg" } | null {
  const lineIndex = getLineIndexAtY(y, lines, layout);
  if (lineIndex < 0) return null;
  const pos = layout.lineTops.get(lines[lineIndex].id);
  if (!pos) return null;
  return { lineIndex, track: y < pos.mainBottom ? "word" : "bg" };
}

// -- Exports -------------------------------------------------------------------

export type { RowLayout, RowLayoutInput };
export {
  computeRowLayout,
  distributeLinesTiming,
  distributeWordsInLine,
  formatTime,
  getLineAndTrackAtY,
  getLineIndexAtY,
  getWordsInInstance,
};
