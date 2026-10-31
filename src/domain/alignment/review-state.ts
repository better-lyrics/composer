import { type AlignedTimings, timingFingerprint } from "@/domain/alignment/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import { isLineTimed } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

type AlignmentReviewTier = "untouched" | "mostly-untouched" | "reviewed";

interface AlignmentReview {
  tier: AlignmentReviewTier;
  untouchedCount: number;
  timedCount: number;
  firstUntouchedLineId: string | null;
}

// -- Constants ----------------------------------------------------------------

const MOSTLY_UNTOUCHED_SHARE = 0.75;

// -- Functions ----------------------------------------------------------------

function tierFor(untouchedCount: number, timedCount: number): AlignmentReviewTier {
  if (untouchedCount === 0) return "reviewed";
  if (untouchedCount === timedCount) return "untouched";
  return untouchedCount / timedCount >= MOSTLY_UNTOUCHED_SHARE ? "mostly-untouched" : "reviewed";
}

function alignmentReview(lines: readonly LyricLine[], alignedTimings: AlignedTimings): AlignmentReview {
  let timedCount = 0;
  let untouchedCount = 0;
  let firstUntouchedLineId: string | null = null;
  for (const line of lines) {
    if (!isLineTimed(line)) continue;
    timedCount++;
    const aligned = alignedTimings[line.id];
    if (aligned === undefined || aligned !== timingFingerprint(line)) continue;
    untouchedCount++;
    firstUntouchedLineId ??= line.id;
  }
  return { tier: tierFor(untouchedCount, timedCount), untouchedCount, timedCount, firstUntouchedLineId };
}

// -- Exports ------------------------------------------------------------------

export { alignmentReview };
export type { AlignmentReview };
