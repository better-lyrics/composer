import type { WordInterval } from "@/domain/alignment/words";
import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";

// Drafting line timings without taps: the alignment model's CTC head places
// every line the user hasn't timed, between the lines they have. Measured in
// hubertfa-posttrain's TAPFREE.md.

// -- Types --------------------------------------------------------------------

interface DraftInputLine {
  /** Timing the draft keeps (a line the user tapped or edited), or null for a line to place. */
  pin: WordInterval | null;
  /** Phones the CTC can place the line by; a line with none stays untimed. */
  phones: number;
}

interface DraftSegment {
  /** Song seconds between the pins either side, where the segment's lines are placed. */
  begin: number;
  end: number;
  /** Indices of the lines to place, in order. */
  lines: number[];
}

interface PhoneSpan {
  /** First and last frame (inclusive) of the phone on the CTC path. */
  first: number;
  last: number;
  logProbSum: number;
}

interface DraftPlacement extends WordInterval {
  /** Mean log-probability of the line's phones on the CTC path. */
  confidence: number;
}

interface ReviewedPlacement extends DraftPlacement {
  /** Worth the user's check before they trust it. */
  flagged: boolean;
}

interface DraftReview {
  /** Per input placement: what to apply, or null to leave the line untimed. */
  lines: (ReviewedPlacement | null)[];
  /** The whole song placed poorly: tapping will beat reviewing. */
  lowConfidence: boolean;
}

/** What a draft gave a line, kept to tell an untouched draft from the user's edit. */
interface DraftMark {
  words: readonly WordTiming[];
  confidence: number;
  flagged: boolean;
}

type DraftRole = { kind: "pin"; bounds: WordInterval } | { kind: "place" } | { kind: "skip" };

// -- Constants ----------------------------------------------------------------

// One reference line in 33,000 spans more than 20 s, while a stray phone in an
// instrumental break can stretch a placed line over minutes.
const MAX_LINE_SECONDS = 20;
// The 20th percentile of line confidence on the study's 80-song sample. Those
// lines held 67% of the lines placed more than 2 s off. The same cut on a song's
// mean warns on 14% of that sample and 41% of the 44 songs with over a fifth of
// their lines off. The study's posteriors came from 30 s chunks; Composer's
// shorter chunks (see ctc-song.ts) score a little higher on the one song
// compared, so slightly fewer lines may be flagged.
const LOW_CONFIDENCE = -2.5;

// -- Functions ----------------------------------------------------------------

// A pin's begin bounds the gap before it, and the latest pin end so far the gap after.
function draftSegments(lines: readonly DraftInputLine[], duration: number): DraftSegment[] {
  const segments: DraftSegment[] = [];
  let begin = 0;
  let pending: number[] = [];
  const close = (end: number) => {
    if (pending.length > 0 && end > begin) segments.push({ begin, end, lines: pending });
    pending = [];
  };
  lines.forEach((line, i) => {
    if (line.pin) {
      close(line.pin.begin);
      begin = Math.max(begin, line.pin.end);
    } else if (line.phones > 0) pending.push(i);
  });
  close(duration);
  return segments;
}

function placeDraftLine(phones: readonly PhoneSpan[], frameSeconds: number): DraftPlacement {
  let sum = 0;
  let frames = 0;
  for (const phone of phones) {
    sum += phone.logProbSum;
    frames += phone.last - phone.first + 1;
  }
  return {
    begin: phones[0].first * frameSeconds,
    end: (phones[phones.length - 1].last + 1) * frameSeconds,
    confidence: sum / frames,
  };
}

function reviewDraft(placements: readonly (DraftPlacement | null)[]): DraftReview {
  const placed = placements.filter((p) => p !== null);
  const mean = placed.reduce((sum, p) => sum + p.confidence, 0) / placed.length;
  return {
    lines: placements.map((p) =>
      p && p.end - p.begin <= MAX_LINE_SECONDS ? { ...p, flagged: p.confidence <= LOW_CONFIDENCE } : null,
    ),
    lowConfidence: placed.length > 0 && mean < LOW_CONFIDENCE,
  };
}

/** Whether a line still has exactly the word timing the draft gave it, so a new draft may move it. */
function isDraftTiming(words: readonly WordTiming[] | undefined, drafted: readonly WordTiming[]): boolean {
  if (!words || words.length !== drafted.length) return false;
  return words.every((w, i) => w.text === drafted[i].text && w.begin === drafted[i].begin && w.end === drafted[i].end);
}

/**
 * What a draft does with each line: keeps the timing the user tapped or edited
 * as a pin, places lines with no timing or with the last draft's untouched, and
 * skips lines with nothing to sing.
 */
function draftRoles(lines: readonly LyricLine[], marks: Readonly<Record<string, DraftMark>>): DraftRole[] {
  return lines.map((line) => {
    const mark = marks[line.id];
    if (mark && isDraftTiming(line.words, mark.words)) return { kind: "place" };
    const bounds = mainBounds(line);
    if (bounds) return { kind: "pin", bounds };
    return hasMainLyrics(line) ? { kind: "place" } : { kind: "skip" };
  });
}

/** Whether the line still has a draft the user should check. */
function isFlaggedDraft(line: LyricLine, mark: DraftMark | undefined): boolean {
  return !!mark?.flagged && isDraftTiming(line.words, mark.words);
}

// -- Exports ------------------------------------------------------------------

export { draftRoles, draftSegments, isDraftTiming, isFlaggedDraft, placeDraftLine, reviewDraft };
export type { DraftMark, DraftPlacement, ReviewedPlacement };
