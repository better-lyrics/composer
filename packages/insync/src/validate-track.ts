import type { SyllableTrack } from "./track";

// -- Types --------------------------------------------------------------------

type TrackRule = "empty-text" | "negative-begin" | "begin-after-end" | "last-joins-next" | "overlaps-previous";

interface TrackFinding {
  index: number;
  rule: TrackRule;
}

interface TrackReport {
  errors: TrackFinding[];
  warnings: TrackFinding[];
}

// -- Validation ---------------------------------------------------------------

function validateTrack(track: SyllableTrack): TrackReport {
  const errors: TrackFinding[] = [];
  const warnings: TrackFinding[] = [];
  let previousEnd: number | undefined;
  track.forEach((syllable, index) => {
    if (syllable.text === "") errors.push({ index, rule: "empty-text" });
    if (syllable.span) {
      const [begin, end] = syllable.span;
      if (begin < 0) errors.push({ index, rule: "negative-begin" });
      if (begin > end) errors.push({ index, rule: "begin-after-end" });
      if (previousEnd !== undefined && begin < previousEnd) warnings.push({ index, rule: "overlaps-previous" });
      previousEnd = end;
    }
    if (index === track.length - 1 && syllable.joinsNext) errors.push({ index, rule: "last-joins-next" });
  });
  return { errors, warnings };
}

// -- Exports ------------------------------------------------------------------

export { validateTrack };
export type { TrackFinding, TrackReport, TrackRule };
