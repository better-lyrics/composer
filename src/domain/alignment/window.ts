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
  /** Seconds of audio kept before the tapped begin. Taps run late, so this is the larger margin. */
  pre: number;
  /** Seconds of audio kept after the tapped end. */
  post: number;
  /** Total audio length; the window never reaches past it. */
  duration: number;
  /** Tapped timing of the line before. The start padding stops where it ends. */
  previous?: LineTaps | null;
}

// -- Constants ----------------------------------------------------------------

// Line mode taps lines back to back, so the previous line usually ends exactly
// where this one starts. The start padding stops there (padding into the
// previous line gave the aligner that line's last word to latch onto), while
// the end reaches a little past the tap so short final words aren't cut off.
// With gaps between lines, the benchmark favoured 0.3 s before and 0.1-0.2 s
// after over no margin or a 1 s lead-in.
const DEFAULT_WINDOW_OPTIONS = { pre: 0.3, post: 0.15 } as const;

// -- Functions ----------------------------------------------------------------

function alignmentWindow(taps: LineTaps, options: WindowOptions): AlignmentWindow {
  let begin = taps.begin - options.pre;
  if (options.previous) begin = Math.max(begin, Math.min(taps.begin, options.previous.end));
  begin = Math.max(0, begin);
  const end = Math.min(options.duration, taps.end + options.post);
  return { begin, end: Math.max(begin, end) };
}

function sliceWindow(samples: Float32Array, sampleRate: number, window: AlignmentWindow): Float32Array {
  const from = Math.max(0, Math.floor(window.begin * sampleRate));
  const to = Math.min(samples.length, Math.ceil(window.end * sampleRate));
  return samples.subarray(from, Math.max(from, to));
}

// -- Exports ------------------------------------------------------------------

export { DEFAULT_WINDOW_OPTIONS, alignmentWindow, sliceWindow };
