import type { LyricLine } from "@/domain/line/model";
import { bgWords } from "@/domain/line/voices";

// -- Constants -----------------------------------------------------------------

const BG_DROP_ZONE_HEIGHT = 24;
const ROW_BORDER = 1;

// -- Functions -----------------------------------------------------------------

// The background sub-track height for one EFFECTIVE row: a full track equal to
// the main height when the row has background words, otherwise the thin drop
// zone. Always pass an effective line (getEffectiveLines), so a line-synced
// background reads as having words rather than as an empty drop zone.
function bgTrackHeightOf(line: LyricLine, mainHeight: number): number {
  const bg = bgWords(line);
  return bg && bg.length > 0 ? mainHeight : BG_DROP_ZONE_HEIGHT;
}

// The total height of one EFFECTIVE row: main height + background sub-track +
// the row border. This is the single source of truth shared by the renderer
// (getRowHeight) and the overlay layout (computeRowLayout). If the two ever
// computed it differently, every overlay positioned over the rows would drift,
// worsening cumulatively down the list.
function rowHeightOf(line: LyricLine, mainHeight: number): number {
  return mainHeight + bgTrackHeightOf(line, mainHeight) + ROW_BORDER;
}

// -- Exports -------------------------------------------------------------------

export { BG_DROP_ZONE_HEIGHT, ROW_BORDER, bgTrackHeightOf, rowHeightOf };
