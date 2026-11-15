import type { SyllableTrack } from "./track";

// -- Types --------------------------------------------------------------------

type TrackRule =
  | "empty-text"
  | "non-finite-time"
  | "negative-begin"
  | "begin-after-end"
  | "last-joins-next"
  | "overlaps-previous";

interface TrackFinding {
  index: number;
  rule: TrackRule;
}

interface TrackReport {
  errors: TrackFinding[];
  warnings: TrackFinding[];
}

// -- Rules --------------------------------------------------------------------

// Imported files bring reversed and overlapping spans in and they are kept, so they warn and never refuse.
const WARNING_RULES: ReadonlySet<string> = new Set<TrackRule>(["begin-after-end", "overlaps-previous"]);

function isWarningRule(rule: string): boolean {
  return WARNING_RULES.has(rule);
}

// -- Validation ---------------------------------------------------------------

function validateTrack(track: SyllableTrack): TrackReport {
  const errors: TrackFinding[] = [];
  const warnings: TrackFinding[] = [];
  const report = (index: number, rule: TrackRule) => (isWarningRule(rule) ? warnings : errors).push({ index, rule });
  let previousEnd: number | undefined;
  track.forEach((syllable, index) => {
    if (syllable.text === "") errors.push({ index, rule: "empty-text" });
    if (syllable.span && !syllable.span.every(Number.isFinite)) {
      errors.push({ index, rule: "non-finite-time" });
    } else if (syllable.span) {
      const [begin, end] = syllable.span;
      if (begin < 0) errors.push({ index, rule: "negative-begin" });
      if (begin > end) report(index, "begin-after-end");
      if (previousEnd !== undefined && begin < previousEnd) report(index, "overlaps-previous");
      previousEnd = end;
    }
    if (index === track.length - 1 && syllable.joinsNext) errors.push({ index, rule: "last-joins-next" });
  });
  return { errors, warnings };
}

// -- Exports ------------------------------------------------------------------

export { isWarningRule, validateTrack };
export type { TrackRule };
