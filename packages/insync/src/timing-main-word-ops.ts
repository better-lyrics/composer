import { drawnSyllables } from "./line-drawn-track";
import { mainTrack, timedSyllables } from "./line-track";
import { mainTimingWrite } from "./line-track-writes";
import { createWordTimingOps } from "./timing-word-ops";

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
