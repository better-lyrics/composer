import type { LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { isWordSelected } from "@/domain/selection/identity";
import {
  type SyllablePosition,
  expandSelectionToGroupmates,
  getSyllablePositions,
} from "@/domain/word/syllable-groups";
import type { DragGhostCell } from "@/views/timeline/drag-ghost";
import type { DragData } from "@/views/timeline/drag-handlers";
import { GROUP_HEADER_HEIGHT } from "@/views/timeline/group-header-row";
import { bgTrackHeight, wordBlockWidth, wordInsetPx } from "@/views/timeline/row-geometry";
import { WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";
import { computeRowLayout } from "@/views/timeline/utils";

// -- Types ---------------------------------------------------------------------

interface DragGhostCells {
  cells: DragGhostCell[];
  anchorWidth: number;
  anchorHeight: number;
}

// -- Functions -----------------------------------------------------------------

// The dragged word, or every selected word with its syllable groupmates, laid out relative to the grabbed block.
function dragGhostCells(activeDrag: DragData, zoom: number, effectiveLines: LyricLine[]): DragGhostCells {
  const { selectedWords, rowHeights, defaultRowHeight, collapsedInstances, focusedGroup } = useTimelineStore.getState();
  const inSelection = isWordSelected(selectedWords, activeDrag.lineId, activeDrag.wordIndex, activeDrag.trackType);

  const layout = computeRowLayout({
    lines: effectiveLines,
    rowHeights,
    defaultRowHeight,
    collapsedInstances,
    focusedGroup,
    waveformHeight: WAVEFORM_HEIGHT,
    groupHeaderHeight: GROUP_HEADER_HEIGHT,
  });

  const rowTops: Record<string, number> = {};
  const rowMainHeights: Record<string, number> = {};
  const rowBgTops: Record<string, number> = {};
  const rowBgHeights: Record<string, number> = {};
  for (const line of effectiveLines) {
    const pos = layout.lineTops.get(line.id);
    if (!pos) continue;
    const mainH = rowHeights[line.id] ?? defaultRowHeight;
    const bgH = bgTrackHeight(line, mainH);
    rowTops[line.id] = pos.top;
    rowMainHeights[line.id] = mainH;
    rowBgTops[line.id] = pos.top + mainH;
    rowBgHeights[line.id] = bgH;
  }

  const anchorLeft = activeDrag.begin * zoom;
  const anchorTop = activeDrag.trackType === "bg" ? rowBgTops[activeDrag.lineId] : rowTops[activeDrag.lineId];
  const anchorHeight =
    activeDrag.trackType === "bg" ? rowBgHeights[activeDrag.lineId] : rowMainHeights[activeDrag.lineId];

  const baseSelections =
    inSelection && selectedWords.length > 1
      ? selectedWords
      : [
          {
            lineId: activeDrag.lineId,
            lineIndex: activeDrag.lineIndex,
            wordIndex: activeDrag.wordIndex,
            type: activeDrag.trackType,
          },
        ];

  const lineById = new Map(effectiveLines.map((l) => [l.id, l]));

  const wordsToShow: typeof baseSelections = [];
  const seen = new Set<string>();
  for (const sel of baseSelections) {
    const line = lineById.get(sel.lineId);
    const wordsArray = line ? trackWords(line, sel.type) : undefined;
    if (!line || !wordsArray) continue;
    const indices = expandSelectionToGroupmates(wordsArray, [sel.wordIndex]);
    for (const idx of indices) {
      const key = `${sel.lineId}:${sel.type}:${idx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      wordsToShow.push({ lineId: sel.lineId, lineIndex: sel.lineIndex, wordIndex: idx, type: sel.type });
    }
  }

  if (wordsToShow.length <= 1) {
    const w = wordBlockWidth(activeDrag.begin, activeDrag.end, zoom);
    const h = anchorHeight - wordInsetPx(activeDrag.trackType) * 2;
    return {
      cells: [
        {
          text: activeDrag.text,
          left: 0,
          top: 0,
          width: w,
          height: h,
          syllablePosition: "none" as SyllablePosition,
          lane: activeDrag.trackType,
        },
      ],
      anchorWidth: w,
      anchorHeight: h,
    };
  }

  const positionsByLineTrack = new Map<string, SyllablePosition[]>();
  const positionFor = (lineId: string, type: "word" | "bg", idx: number): SyllablePosition => {
    const key = `${lineId}:${type}`;
    let positions = positionsByLineTrack.get(key);
    if (!positions) {
      const line = lineById.get(lineId);
      const wordsArray = line ? trackWords(line, type) : undefined;
      positions = wordsArray ? getSyllablePositions(wordsArray) : [];
      positionsByLineTrack.set(key, positions);
    }
    return positions[idx] ?? "none";
  };

  const cells = wordsToShow.map((sel) => {
    const line = lineById.get(sel.lineId);
    const wordsArray = line ? trackWords(line, sel.type) : undefined;
    const word = wordsArray?.[sel.wordIndex];
    if (!word || !line)
      return {
        text: "",
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        syllablePosition: "none" as SyllablePosition,
        lane: sel.type,
      };

    const cellLeft = word.begin * zoom - anchorLeft;
    const cellTop = (sel.type === "bg" ? rowBgTops[line.id] : rowTops[line.id]) - anchorTop;
    const cellWidth = wordBlockWidth(word.begin, word.end, zoom);
    const cellHeight =
      (sel.type === "bg" ? rowBgHeights[line.id] : rowMainHeights[line.id]) - wordInsetPx(sel.type) * 2;

    return {
      text: word.text.trimEnd(),
      left: cellLeft,
      top: cellTop,
      syllablePosition: positionFor(sel.lineId, sel.type, sel.wordIndex),
      width: cellWidth,
      height: cellHeight,
      lane: sel.type,
    };
  });

  const anchorW = wordBlockWidth(activeDrag.begin, activeDrag.end, zoom);
  return { cells, anchorWidth: anchorW, anchorHeight: anchorHeight - wordInsetPx(activeDrag.trackType) * 2 };
}

// -- Exports -------------------------------------------------------------------

export { dragGhostCells };
