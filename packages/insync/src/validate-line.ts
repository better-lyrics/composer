import type { SavedLine, SavedTrack } from "./saved-line";
import { isWarningRule, type TrackRule, validateTrack } from "./validate-track";

// -- Types --------------------------------------------------------------------

type LineRule = TrackRule | "span-and-syllable-times" | "duplicate-id" | "track-order";

interface LineFinding {
  track: number;
  syllable?: number;
  rule: LineRule;
}

interface LineReport {
  errors: LineFinding[];
  warnings: LineFinding[];
}

// -- Validation ---------------------------------------------------------------

function trackSpanFindings(track: SavedTrack, index: number): LineFinding[] {
  if (!track.span) return [];
  const findings: LineFinding[] = [];
  const [begin, end] = track.span;
  if (!track.span.every(Number.isFinite)) {
    findings.push({ track: index, rule: "non-finite-time" });
  } else {
    if (begin < 0) findings.push({ track: index, rule: "negative-begin" });
    if (begin > end) findings.push({ track: index, rule: "begin-after-end" });
  }
  if (track.syllables.some((syllable) => syllable.span)) {
    findings.push({ track: index, rule: "span-and-syllable-times" });
  }
  return findings;
}

function duplicateIdFindings(line: SavedLine): LineFinding[] {
  const seen = new Set<string>();
  const findings: LineFinding[] = [];
  const see = (id: string | undefined, finding: LineFinding) => {
    if (id === undefined) return;
    if (seen.has(id)) findings.push(finding);
    seen.add(id);
  };
  line.tracks.forEach((track, index) => {
    see(track.id, { track: index, rule: "duplicate-id" });
    track.syllables.forEach((syllable, at) => see(syllable.id, { track: index, syllable: at, rule: "duplicate-id" }));
  });
  return findings;
}

function trackOrderFindings(line: SavedLine): LineFinding[] {
  return line.tracks.flatMap((track, index): LineFinding[] => {
    const expected = index === 0 ? "main" : "bg";
    return track.role === expected && index < 2 ? [] : [{ track: index, rule: "track-order" }];
  });
}

// A line's ids are unique, the main track comes first with at most one background after it, and a track is timed
// by a span or by its syllables, never both. Imported spans reversed or out of order stay as warnings.
function validateLine(line: SavedLine): LineReport {
  const errors: LineFinding[] = [...duplicateIdFindings(line), ...trackOrderFindings(line)];
  const warnings: LineFinding[] = [];
  line.tracks.forEach((track, index) => {
    for (const finding of trackSpanFindings(track, index))
      (isWarningRule(finding.rule) ? warnings : errors).push(finding);
    const report = validateTrack(
      track.syllables.map(({ text, sep, joinsNext, span }) => ({ text, sep, joinsNext: joinsNext === true, span })),
    );
    errors.push(...report.errors.map(({ index: syllable, rule }) => ({ track: index, syllable, rule })));
    warnings.push(...report.warnings.map(({ index: syllable, rule }) => ({ track: index, syllable, rule })));
  });
  return { errors, warnings };
}

// -- Exports ------------------------------------------------------------------

export { validateLine };
