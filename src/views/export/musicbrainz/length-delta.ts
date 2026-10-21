import type { RankedMatch } from "@/domain/musicbrainz/rank-matches";
import { formatTime } from "@/utils/format-time";

// -- Labels -------------------------------------------------------------------

function recordingLength(match: RankedMatch): string | null {
  const { length } = match.recording;
  return length ? formatTime(length / 1000, 0) : null;
}

function lengthDeltaLabel(match: RankedMatch): string | null {
  const delta = match.lengthDeltaSec;
  if (delta === null) return null;
  return `${formatTime(Math.abs(delta), 0)} ${delta < 0 ? "shorter" : "longer"}`;
}

// -- Exports ------------------------------------------------------------------

export { lengthDeltaLabel, recordingLength };
