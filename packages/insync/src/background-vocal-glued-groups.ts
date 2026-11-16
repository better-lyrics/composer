import type { ParenGroup } from "./background-vocal-extraction";
import type { LyricLine } from "./line";
import { wordContentSpans } from "./line-reconstruct-text";
import { mainTrack } from "./line-track";

// -- Functions ----------------------------------------------------------------

// Groups a syllable reaches into from outside, as a timed word holding a bracket does: they stay text.
function gluedGroups(line: LyricLine, groups: readonly ParenGroup[], splitChar: string): Set<ParenGroup> {
  const spans = wordContentSpans(mainTrack(line).syllables, splitChar);
  const glued = new Set<ParenGroup>();
  for (const group of groups) {
    const reached = spans.some(
      (span) =>
        span.start < group.end + 1 && span.end > group.start && (span.start < group.start || span.end > group.end + 1),
    );
    if (reached) glued.add(group);
  }
  return glued;
}

// -- Exports ------------------------------------------------------------------

export { gluedGroups };
