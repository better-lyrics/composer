import { type TimeRange, wholeSongRange } from "@/domain/group/shared-timing";
import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { boundsOverlap } from "@/domain/word/overlap";
import { pastedWordBounds } from "@/views/timeline/apply-paste-to-lines";
import { bgTrackHeight, wordBlockWidth } from "@/views/timeline/row-geometry";
import type { ClipboardData } from "@/views/timeline/selection-types";
import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";
import type { RowLayout } from "@/views/timeline/utils";

// -- Interfaces ----------------------------------------------------------------

interface GhostWord {
  text: string;
  left: number;
  width: number;
  trackTop: number;
  trackHeight: number;
  overlaps: boolean;
  outOfBounds: boolean;
  isBg: boolean;
}

// -- Constants -----------------------------------------------------------------

const BG_BORDER = 1;

// -- Functions -----------------------------------------------------------------

function computeGhosts(
  clipboard: ClipboardData,
  targetLineIndex: number,
  timeDelta: number,
  lines: LyricLine[],
  zoom: number,
  duration: number,
  rangeOf: (line: LyricLine) => TimeRange,
  layout: RowLayout,
  defaultRowHeight: number,
): GhostWord[] {
  const ghosts: GhostWord[] = [];

  let layoutEnd = 0;
  for (const pos of layout.lineTops.values()) layoutEnd = Math.max(layoutEnd, pos.top + pos.height);
  for (const pos of layout.headerTops.values()) layoutEnd = Math.max(layoutEnd, pos.top + pos.height);

  for (const entry of clipboard.entries) {
    const lineIdx = targetLineIndex + entry.lineOffset;
    const inRange = lineIdx >= 0 && lineIdx < lines.length;
    const targetLine = inRange ? lines[lineIdx] : null;
    const targetPos = targetLine ? layout.lineTops.get(targetLine.id) : null;
    const outOfBounds = !targetLine || !targetPos;
    const isBg = entry.trackType === "bg";

    const pasted = pastedWordBounds(entry.word, timeDelta, targetLine ? rangeOf(targetLine) : wholeSongRange(duration));

    const left = GUTTER_WIDTH + pasted.begin * zoom;
    const width = wordBlockWidth(pasted.begin, pasted.end, zoom);

    let overlaps = outOfBounds;
    if (targetLine && !outOfBounds) {
      const existingWords = effectiveTrackWords(targetLine, isBg ? "bg" : "word") ?? [];
      overlaps = existingWords.some((existing) => boundsOverlap(pasted, existing));
    }

    let trackTop: number;
    let trackHeight: number;

    if (!targetPos || !targetLine) {
      trackTop = layoutEnd;
      trackHeight = defaultRowHeight;
    } else {
      const mainHeight = targetPos.mainBottom - targetPos.top;
      const bgHeight = bgTrackHeight(targetLine, mainHeight);
      if (isBg) {
        trackTop = targetPos.top + mainHeight + BG_BORDER;
        trackHeight = bgHeight;
      } else {
        trackTop = targetPos.top;
        trackHeight = mainHeight;
      }
    }

    ghosts.push({
      text: entry.word.text,
      left,
      width,
      trackTop,
      trackHeight,
      overlaps,
      outOfBounds,
      isBg,
    });
  }

  return ghosts;
}

// -- Exports -------------------------------------------------------------------

export { computeGhosts };
