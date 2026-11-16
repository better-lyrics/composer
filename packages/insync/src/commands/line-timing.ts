import type { LyricCommand } from "./command";
import { lineEditCommand } from "./line-edits";
import { refused } from "./outcome";
import type { LineUpdate } from "../line";
import { withSeededBackground } from "../line-background";
import { mainTrack } from "../line-track";
import { withMainTrack, withTrackSpan } from "../line-track-writes";

// -- Commands -----------------------------------------------------------------

// Times an untimed line as one block, sized to its words; an untimed background is timed with it.
function placeLineAt(lineId: string, begin: number, end: number): LyricCommand {
  return lineEditCommand({ command: "place line", args: [lineId, begin, end] }, (root, ctx) => {
    const line = root.lines.find((candidate) => candidate.id === lineId);
    if (!line) return refused({ reason: "line-gone", lineId });
    const placed = withSeededBackground(
      withMainTrack(line, withTrackSpan(mainTrack(line), begin, end)),
      ctx.splitChar,
      ctx.songEnd,
    );
    return [{ id: lineId, updates: { tracks: placed.tracks } }];
  });
}

// The converter mints the new word ids, so the caller passes the words it made and can select them.
function convertToWordTiming(converted: readonly LineUpdate[]): LyricCommand {
  return lineEditCommand(
    { command: "convert to word timing", args: converted.map((update) => update.id) },
    () => converted,
  );
}

// -- Exports ------------------------------------------------------------------

export { convertToWordTiming, placeLineAt };
