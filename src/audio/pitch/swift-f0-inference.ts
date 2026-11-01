import type { Ort, OrtSession, OrtTensor } from "@/audio/ort-runtime";
import { type InferenceWindow, SWIFT_F0_MAX_HZ, SWIFT_F0_MIN_HZ } from "@/domain/pitch/swift-f0-frames";

// -- Types --------------------------------------------------------------------

interface WindowPitch {
  outputFrom: number;
  frequencyHz: Float32Array;
  confidence: Float32Array;
}

interface PitchRange {
  fmin: OrtTensor;
  fmax: OrtTensor;
}

// -- Functions ----------------------------------------------------------------

function pitchRange(ort: Ort): PitchRange {
  return {
    fmin: new ort.Tensor("float32", Float32Array.of(SWIFT_F0_MIN_HZ), []),
    fmax: new ort.Tensor("float32", Float32Array.of(SWIFT_F0_MAX_HZ), []),
  };
}

// One window with its context; only the frames it owns are kept.
async function inferPitchWindow(
  ort: Ort,
  session: OrtSession,
  range: PitchRange,
  audio16k: Float32Array,
  window: InferenceWindow,
): Promise<WindowPitch> {
  const samples = audio16k.slice(window.sampleStart, window.sampleEnd);
  const audio = new ort.Tensor("float32", samples, [1, samples.length]);
  const output = await session.run({ audio, fmin: range.fmin, fmax: range.fmax });
  return {
    outputFrom: window.outputFrom,
    frequencyHz: output.pitch.data.slice(window.keepFrom, window.keepTo),
    confidence: output.confidence.data.slice(window.keepFrom, window.keepTo),
  };
}

// -- Exports ------------------------------------------------------------------

export { inferPitchWindow, pitchRange };
export type { WindowPitch };
