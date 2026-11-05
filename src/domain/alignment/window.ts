// -- Types --------------------------------------------------------------------

interface LineTaps {
  begin: number;
  end: number;
}

interface AlignmentWindow {
  begin: number;
  end: number;
}

interface WindowOptions {
  /** Total audio length; the window never reaches past it. */
  duration: number;
  /** Timing of the line before, when it has any. */
  previous?: LineTaps | null;
}

// -- Constants ----------------------------------------------------------------

// The rules and numbers below are hubertfa-posttrain's step-1 configuration
// (STEP1.md), which took Line mode from 36.0 to 58.9 lines with every word
// within 200 ms on a held-out set of 453 songs.

// Taps run late, and in Line mode the previous line ends exactly where this
// one was tapped, so stopping there cut the start off 83% of lines. A line
// whose previous line has an end of its own (a word-synced line being
// re-aligned, say) keeps the shorter lead-in that stops at that end: there
// the extra audio is the previous line's tail, which the aligner latches onto.
const LEAD_IN = 0.6;
const CLIPPED_LEAD_IN = 0.3;
// The end reaches a little past the tap so short final words aren't cut off.
const TAIL = 0.15;
// Where the model looks for the line's phones (CTC) before the final pass.
const SEARCH_LEAD_IN = 1.0;
const SEARCH_TAIL = 0.3;
// The final pass runs from 0.3 s before the CTC start, when that start is
// within 0.5 s of the tap, to 0.3 s after the CTC end.
const CTC_MARGIN = 0.3;
const CTC_START_GATE = 0.5;
const MIN_REFINED_SECONDS = 0.1;
// A line followed by an instrumental break runs to the next tap, a minute or
// more of audio: a WebGPU hang or out-of-memory risk. 99.97% of sung lines in
// the benchmark's 626k are under 15 s with these margins.
const MAX_WINDOW_SECONDS = 15;

// -- Functions ----------------------------------------------------------------

function capWindow(window: AlignmentWindow): AlignmentWindow {
  return { begin: window.begin, end: Math.max(window.begin, Math.min(window.end, window.begin + MAX_WINDOW_SECONDS)) };
}

// In Line mode a tap closes the line before at this line's begin; a jump leaves it zero length.
function hasOwnEnd(previous: LineTaps, taps: LineTaps): boolean {
  return previous.end > previous.begin && previous.end !== taps.begin;
}

// The lead-in Composer used before step 1: 0.3 s, stopped at the previous line's end.
function clippedBegin(taps: LineTaps, previous: LineTaps | null | undefined): number {
  const begin = taps.begin - CLIPPED_LEAD_IN;
  return previous ? Math.max(begin, Math.min(taps.begin, previous.end)) : begin;
}

function tailedWindow(begin: number, taps: LineTaps, duration: number): AlignmentWindow {
  const from = Math.max(0, begin);
  return capWindow({ begin: from, end: Math.max(from, Math.min(duration, taps.end + TAIL)) });
}

function alignmentWindow(taps: LineTaps, options: WindowOptions): AlignmentWindow {
  const { previous } = options;
  const begin = previous && hasOwnEnd(previous, taps) ? clippedBegin(taps, previous) : taps.begin - LEAD_IN;
  return tailedWindow(begin, taps, options.duration);
}

function searchWindow(taps: LineTaps, duration: number): AlignmentWindow {
  const begin = Math.max(0, taps.begin - SEARCH_LEAD_IN);
  return capWindow({ begin, end: Math.max(begin, Math.min(duration, taps.end + SEARCH_TAIL)) });
}

/**
 * The window the line is aligned in once the CTC search found its phones at
 * `ctc` (song seconds), or `plain` when it didn't.
 */
function refinedWindow(
  taps: LineTaps,
  plain: AlignmentWindow,
  search: AlignmentWindow,
  ctc: AlignmentWindow | null,
): AlignmentWindow {
  if (!ctc) return plain;
  const begin =
    Math.abs(ctc.begin - taps.begin) < CTC_START_GATE ? Math.max(search.begin, ctc.begin - CTC_MARGIN) : plain.begin;
  const end = Math.min(search.end, ctc.end + CTC_MARGIN);
  return end - begin < MIN_REFINED_SECONDS ? plain : { begin, end };
}

/**
 * The window a line's background vocals are aligned in, around `taps`: the
 * line's span joined with its background words'. They have no tap of their
 * own, so they keep the window Composer used before step 1: 0.3 s before,
 * stopped at the previous line's end, to 0.15 s after. On hubertfa-posttrain's
 * BGVOCALS.md holdout that beat step 1's 0.6 s lead-in, a window running on to
 * the next line's end, and the CTC search.
 */
function backgroundWindow(taps: LineTaps, options: WindowOptions): AlignmentWindow {
  return tailedWindow(clippedBegin(taps, options.previous), taps, options.duration);
}

function sliceWindow(samples: Float32Array, sampleRate: number, window: AlignmentWindow): Float32Array {
  const from = Math.max(0, Math.floor(window.begin * sampleRate));
  const to = Math.min(samples.length, Math.ceil(window.end * sampleRate));
  return samples.subarray(from, Math.max(from, to));
}

// -- Exports ------------------------------------------------------------------

export type { AlignmentWindow };
export { LEAD_IN, alignmentWindow, backgroundWindow, capWindow, refinedWindow, searchWindow, sliceWindow };
