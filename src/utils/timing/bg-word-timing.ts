import { manualBackgroundWordEdit } from "@/domain/line/lane-word-edits";
import { backgroundTrack, timedSyllables } from "@/domain/line/track";
import { withRoleWords } from "@/domain/line/track-writes";
import { createWordTimingOps } from "@/utils/timing/word-timing-ops";

const { retimeEdit, boundaryEdit, stepEdit } = createWordTimingOps({
  getWords: (line) => timedSyllables(backgroundTrack(line)),
  writeWords: (line, words) => ({ tracks: withRoleWords(line, "bg", words).tracks }),
  buildBoundaryUpdate: (line, words) => manualBackgroundWordEdit(line, words),
});

export { boundaryEdit as bgWordBoundaryEdit, retimeEdit as bgWordRetimeEdit, stepEdit as stepBgWordEdit };
