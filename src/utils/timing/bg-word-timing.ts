import { drawnSyllables } from "@/domain/line/drawn-track";
import { manualBackgroundWordEdit } from "@/domain/line/lane-word-edits";
import { backgroundTrack, timedSyllables } from "@/domain/line/track";
import { backgroundTimingWrite } from "@/domain/line/track-writes";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

// Timeline edits read the background as the Timeline draws it; Sync retimes only its timed syllables.
const drawnOps = createWordTimingOps({
  getWords: (line) => drawnSyllables(line, "bg"),
  writeWords: backgroundTimingWrite,
  buildBoundaryUpdate: (line, words) => manualBackgroundWordEdit(line, words),
});
const timedOps = createWordTimingOps({
  getWords: (line) => timedSyllables(backgroundTrack(line)),
  writeWords: backgroundTimingWrite,
});

const { boundaryEdit, stepEdit } = drawnOps;
const { retimeEdit } = timedOps;

export { boundaryEdit as bgWordBoundaryEdit, retimeEdit as bgWordRetimeEdit, stepEdit as stepBgWordEdit };
