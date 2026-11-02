import { ctcClasses, writeChunkLogProbs } from "@/audio/alignment/hubertfa/ctc-emissions";
import { type CtcEmissions, ctcViterbi } from "@/audio/alignment/hubertfa/ctc-viterbi";

// Where a line's phones sit in a window, by CTC Viterbi over the model's
// `ctc_logits`: a port of hubertfa-posttrain's step-1 ctc_bounds (STEP1.md),
// which the alignment window's start and end refinement was validated with.

// -- Types --------------------------------------------------------------------

interface CtcBoundsInput {
  /** `ctc_logits` for one item, laid out [vocab, outputFrames]. */
  logits: Float32Array;
  outputFrames: number;
  /** Samples in the window the model saw. */
  numSamples: number;
  hopSize: number;
  /** The line's phone ids in sung order, silences left out. */
  phoneIds: Int32Array;
}

/** Frames, from the window's first sample: the first phone's first frame, and the frame after the last phone. */
interface CtcBounds {
  first: number;
  end: number;
}

// -- Functions ----------------------------------------------------------------

function ctcLineBounds({ logits, outputFrames, numSamples, hopSize, phoneIds }: CtcBoundsInput): CtcBounds | null {
  // The frames the window's samples cover, as the decoder and the Python cut the output.
  const frames = Math.min(outputFrames, Math.floor((numSamples + 0.5) / hopSize));
  if (phoneIds.length === 0 || frames < phoneIds.length) return null;
  const classIds = ctcClasses(phoneIds);
  const classOf = new Map(Array.from(classIds, (id, c) => [id, c]));
  const emissions: CtcEmissions = {
    logProbs: new Float32Array(frames * classIds.length),
    frames,
    classes: classIds.length,
  };
  writeChunkLogProbs(emissions, classIds, { start: 0, frames, keepFrom: 0, keepTo: frames }, logits, outputFrames);
  const tokens = Int32Array.from(phoneIds, (id) => classOf.get(id)!);
  const spans = ctcViterbi(emissions, tokens);
  if (!spans) return null;
  return { first: spans[0].first, end: spans[spans.length - 1].last + 1 };
}

// -- Exports ------------------------------------------------------------------

export { ctcLineBounds };
