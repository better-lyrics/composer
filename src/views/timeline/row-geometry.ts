import type { LyricLine } from "@/domain/line/model";

// -- Types ---------------------------------------------------------------------

type WordTrackType = "word" | "bg";

// -- Constants -----------------------------------------------------------------

const BG_DROP_ZONE_HEIGHT = 24;
const BG_LANE_HEIGHT = 26;
const ROW_BORDER = 1;
const WORD_INSET_PX: Record<WordTrackType, number> = { word: 5, bg: 3 };

// -- Functions -----------------------------------------------------------------

function bgTrackHeight(line: LyricLine): number {
  return line.backgroundWords?.length ? BG_LANE_HEIGHT : BG_DROP_ZONE_HEIGHT;
}

function lineRowHeight(line: LyricLine, mainHeight: number): number {
  return mainHeight + bgTrackHeight(line) + ROW_BORDER;
}

function emptyBgRowHeight(mainHeight: number): number {
  return mainHeight + BG_DROP_ZONE_HEIGHT + ROW_BORDER;
}

// Neighbouring blocks keep a 1px gap; a very short word still shows a sliver.
function wordBlockWidth(begin: number, end: number, zoom: number): number {
  return Math.max((end - begin) * zoom - 1, 4);
}

function wordInsetPx(track: string | undefined): number {
  return track === "bg" ? WORD_INSET_PX.bg : WORD_INSET_PX.word;
}

// -- Exports -------------------------------------------------------------------

export type { WordTrackType };
export {
  BG_DROP_ZONE_HEIGHT,
  BG_LANE_HEIGHT,
  bgTrackHeight,
  emptyBgRowHeight,
  lineRowHeight,
  wordBlockWidth,
  wordInsetPx,
};
