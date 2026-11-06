import type { AlignmentCounts } from "@/domain/alignment/build-tag";
import { type AlignedTimings, timingFingerprint } from "@/domain/alignment/fingerprint";
import { coversSpan, type HeardRange } from "@/domain/alignment/heard-ranges";
import { effectiveBounds } from "@/domain/line/bounds";
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

interface AlignmentBreakdown {
  counts: AlignmentCounts;
  untouchedIds: Set<string>;
}

// -- Constants ----------------------------------------------------------------

const MOSTLY_UNTOUCHED_SHARE = 0.75;

// -- Functions ----------------------------------------------------------------

function tierFor(untouchedCount: number, timedCount: number): AlignmentReviewTier {
  if (untouchedCount === 0) return "reviewed";
  if (untouchedCount === timedCount) return "untouched";
  return untouchedCount / timedCount >= MOSTLY_UNTOUCHED_SHARE ? "mostly-untouched" : "reviewed";
}

function isUntouched(line: LyricLine, alignedTimings: AlignedTimings): boolean {
  const aligned = alignedTimings[line.id];
  return aligned !== undefined && aligned === timingFingerprint(line);
}

function alignmentReview(lines: readonly LyricLine[], alignedTimings: AlignedTimings): AlignmentReview {
  let timedCount = 0;
  let untouchedCount = 0;
  let firstUntouchedLineId: string | null = null;
  for (const line of lines) {
    if (!isLineTimed(line)) continue;
    timedCount++;
    if (!isUntouched(line, alignedTimings)) continue;
    untouchedCount++;
    firstUntouchedLineId ??= line.id;
  }
  return { tier: tierFor(untouchedCount, timedCount), untouchedCount, timedCount, firstUntouchedLineId };
}

function alignmentBreakdown(
  lines: readonly LyricLine[],
  alignedTimings: AlignedTimings,
  heard: readonly HeardRange[],
): AlignmentBreakdown {
  const counts: AlignmentCounts = { untouched: 0, heard: 0, fixed: 0, handSynced: 0 };
  const untouchedIds = new Set<string>();
  for (const line of lines) {
    if (!isLineTimed(line)) continue;
    if (alignedTimings[line.id] === undefined) counts.handSynced++;
    else if (!isUntouched(line, alignedTimings)) counts.fixed++;
    else {
      counts.untouched++;
      untouchedIds.add(line.id);
      const bounds = effectiveBounds(line);
      if (bounds && coversSpan(heard, bounds.begin, bounds.end)) counts.heard++;
    }
  }
  return { counts, untouchedIds };
}

// -- Exports ------------------------------------------------------------------

export type { AlignmentReview };
export { alignmentBreakdown, alignmentReview };
