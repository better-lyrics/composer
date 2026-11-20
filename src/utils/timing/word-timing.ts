import { drawnSyllables } from "@/domain/line/drawn-track";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { mainTimingWrite } from "@/domain/line/track-writes";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

// Timeline edits read the main track as the Timeline draws it; Sync retimes only its timed syllables.
const drawnOps = createWordTimingOps({ getWords: (line) => drawnSyllables(line, "main"), writeWords: mainTimingWrite });
const timedOps = createWordTimingOps({
  getWords: (line) => timedSyllables(mainTrack(line)),
  writeWords: mainTimingWrite,
});

const { boundaryEdit: wordBoundaryEdit, stepEdit: stepWordEdit } = drawnOps;
const { retimeEdit: wordRetimeEdit } = timedOps;

export { stepWordEdit, wordBoundaryEdit, wordRetimeEdit };
