import { drawnSyllables } from "insync/line-drawn-track";
import { manualBackgroundWordEdit } from "insync/line-lane-word-edits";
import { backgroundTimingWrite } from "insync/line-track-writes";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

// Timeline and Sync edits read the background as the Timeline draws it: a line-synced one as one block.
const drawnOps = createWordTimingOps({
  getWords: (line, splitChar) => drawnSyllables(line, "bg", splitChar),
  writeWords: backgroundTimingWrite,
  buildBoundaryUpdate: (line, words, splitChar) => manualBackgroundWordEdit(line, words, splitChar),
});
const { boundaryEdit, stepEdit, retimeEdit } = drawnOps;

export { boundaryEdit as bgWordBoundaryEdit, retimeEdit as bgWordRetimeEdit, stepEdit as stepBgWordEdit };
