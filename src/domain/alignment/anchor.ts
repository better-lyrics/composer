import { hasLetterOrDigit } from "@/domain/alignment/cjk";
import { type AlignmentWindow, capWindow, LEAD_IN } from "@/domain/alignment/window";
import type { AlignmentWord, PartSplit, WordInterval } from "@/domain/alignment/words";

// The anchored lead-in (STEP1.md's C2): a line starts its window just before
// the previous line's last word, with that word prepended to its transcript,
// so the aligner sees a known word before the line instead of guessing where
// the line starts after a late tap. The anchor's own timing is discarded, and
// the previous line never changes.

// -- Types --------------------------------------------------------------------

/** A line's last word as this run aligned and stored it. */
interface AnchorWord {
  parts: string[];
  begin: number;
  end: number;
}

/** The last line this run aligned, for the line after it. */
interface AnchorChain {
  lineId: string;
  word: AnchorWord | null;
  /** The line's own anchor was rejected, so the next line isn't anchored. */
  cooling: boolean;
}

// -- Constants ----------------------------------------------------------------

/** Audio kept before the anchor word's onset. */
const ANCHOR_LEAD = 0.1;
/** The anchor may move this far from where the previous line put it. */
const ANCHOR_TOLERANCE = 0.2;
/** The anchor word starts at most this long before the tap (longer is a held note, not a lead-in). */
const ANCHOR_SPAN = 1.5;
/** At most this much silence between the anchor word and the tap (more is a break). */
const ANCHOR_GAP = 1.0;

// -- Functions ----------------------------------------------------------------

/** A line's last word, as stored, when it has something to pronounce. */
function lastWord(words: readonly AlignmentWord[], intervals: readonly WordInterval[]): AnchorWord | null {
  const word = words[words.length - 1];
  if (!word || !hasLetterOrDigit(word.text) || intervals.length < word.parts.length) return null;
  const first = intervals[intervals.length - word.parts.length];
  return { parts: word.parts, begin: first.begin, end: intervals[intervals.length - 1].end };
}

/**
 * The anchored window for a line tapped at `taps`, or null when it isn't
 * anchored: the line before wasn't aligned just now, its anchor was rejected,
 * or its last word is too far from the tap or too close to the song's start.
 */
function anchorWindow(
  chain: AnchorChain | null,
  previousId: string | null,
  taps: WordInterval,
  plain: AlignmentWindow,
): AlignmentWindow | null {
  if (!chain || chain.lineId !== previousId || chain.cooling || !chain.word) return null;
  const { begin, end } = chain.word;
  if (taps.begin - end > ANCHOR_GAP || begin >= taps.begin || taps.begin - begin > ANCHOR_SPAN) return null;
  if (begin - ANCHOR_LEAD < 0) return null;
  return capWindow({ begin: begin - ANCHOR_LEAD, end: plain.end });
}

/**
 * Whether an anchored alignment is kept: the anchor stayed near where the
 * previous line put it, and the line doesn't start well before its tap.
 * `placed` is the anchor's decoded interval and `firstBegin` the line's first
 * word's, both in song time and before any clamping.
 */
function keepsAnchored(anchor: AnchorWord, placed: WordInterval, firstBegin: number, taps: WordInterval): boolean {
  return Math.abs(placed.begin - anchor.begin) <= ANCHOR_TOLERANCE && firstBegin >= taps.begin - LEAD_IN;
}

/**
 * The line's part intervals and syllable splits from an alignment whose
 * first `anchorParts` parts were the anchor word's, and where the anchor landed.
 */
function withoutAnchor(
  aligned: { intervals: WordInterval[]; splits: PartSplit[] },
  anchorParts: number,
): { intervals: WordInterval[]; splits: PartSplit[]; anchor: WordInterval | null } {
  const { intervals, splits } = aligned;
  if (anchorParts === 0) return { intervals, splits, anchor: null };
  return {
    intervals: intervals.slice(anchorParts),
    splits: splits.filter((s) => s.part >= anchorParts).map((s) => ({ ...s, part: s.part - anchorParts })),
    anchor: { begin: intervals[0].begin, end: intervals[anchorParts - 1].end },
  };
}

// -- Exports ------------------------------------------------------------------

export type { AnchorChain, AnchorWord };
export { anchorWindow, keepsAnchored, lastWord, withoutAnchor };
