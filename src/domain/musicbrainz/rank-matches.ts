import type { MbRecording } from "@/domain/musicbrainz/types";

// -- Constants ----------------------------------------------------------------

const LENGTH_TOLERANCE_SEC = 3;

// -- Types --------------------------------------------------------------------

interface RankedMatch {
  recording: MbRecording;
  lengthDeltaSec: number | null;
  matchesAudio: boolean;
}

// -- Ranking ------------------------------------------------------------------

function toRankedMatch(recording: MbRecording, durationSec: number | null): RankedMatch {
  const lengthDeltaSec = durationSec && recording.length ? recording.length / 1000 - durationSec : null;
  const matchesAudio = lengthDeltaSec !== null && Math.abs(lengthDeltaSec) <= LENGTH_TOLERANCE_SEC;
  return { recording, lengthDeltaSec, matchesAudio };
}

const deltaDistance = (match: RankedMatch): number => Math.abs(match.lengthDeltaSec ?? Number.POSITIVE_INFINITY);

function compareMatches(a: RankedMatch, b: RankedMatch): number {
  return (
    Number(b.matchesAudio) - Number(a.matchesAudio) ||
    Number(!b.recording.disambiguation) - Number(!a.recording.disambiguation) ||
    (b.recording.score ?? 0) - (a.recording.score ?? 0) ||
    deltaDistance(a) - deltaDistance(b)
  );
}

function rankMatches(recordings: readonly MbRecording[], durationSec: number | null): RankedMatch[] {
  return recordings.map((recording) => toRankedMatch(recording, durationSec)).toSorted(compareMatches);
}

// -- Exports ------------------------------------------------------------------

export { rankMatches };
export type { RankedMatch };
