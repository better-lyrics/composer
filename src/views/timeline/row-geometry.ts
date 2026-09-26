import type { LyricLine } from "@/domain/line/model";

// -- Constants -----------------------------------------------------------------

const BG_DROP_ZONE_HEIGHT = 24;
const ROW_BORDER = 1;

// -- Functions -----------------------------------------------------------------

function bgTrackHeight(line: LyricLine, mainHeight: number): number {
  return line.backgroundWords?.length ? mainHeight : BG_DROP_ZONE_HEIGHT;
}

function lineRowHeight(line: LyricLine, mainHeight: number): number {
  return mainHeight + bgTrackHeight(line, mainHeight) + ROW_BORDER;
}

// -- Exports -------------------------------------------------------------------

export { BG_DROP_ZONE_HEIGHT, bgTrackHeight, lineRowHeight };
