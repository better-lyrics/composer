import { drawnSyllables } from "insync/line-drawn-track";
import { mainTrack, timedSyllables } from "insync/line-track";
import { mainTimingWrite } from "insync/line-track-writes";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

// Timeline edits read the main track as the Timeline draws it; Sync retimes only its timed syllables.
const drawnOps = createWordTimingOps({
  getWords: (line, splitChar) => drawnSyllables(line, "main", splitChar),
  writeWords: mainTimingWrite,
});
const timedOps = createWordTimingOps({
  getWords: (line) => timedSyllables(mainTrack(line)),
  writeWords: mainTimingWrite,
});

const { boundaryEdit: wordBoundaryEdit, stepEdit: stepWordEdit } = drawnOps;
const { retimeEdit: wordRetimeEdit } = timedOps;

export { stepWordEdit, wordBoundaryEdit, wordRetimeEdit };
