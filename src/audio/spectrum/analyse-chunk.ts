import { forEachStftFrame, stftFrameCount } from "@/audio/separation/stft";
import { CHUNK_FRAMES } from "@/domain/spectrum/chunk-order";
import { encodeDb } from "@/domain/spectrum/levels";

// -- Types --------------------------------------------------------------------

interface AnalysedChunk {
  firstFrame: number;
  frameCount: number;
  magnitude: Uint8Array;
  phaseChange: Uint8Array;
  rawPhase: Uint8Array | null;
}

// -- Constants ----------------------------------------------------------------

const TAU = 2 * Math.PI;
const SEED_FRAMES = 2;

// -- Functions ----------------------------------------------------------------

function wrapPhase(angle: number): number {
  return angle - TAU * Math.round(angle / TAU);
}

// Phase change is the frame-to-frame change of each bin's deviation from its expected advance:
// steady tones sit near zero, noise and transients jump. Two frames before the chunk seed it.
function analyseChunk(
  pcm: Float32Array,
  fftSize: number,
  hop: number,
  chunk: number,
  withRawPhase: boolean,
): AnalysedChunk {
  const framing = { fftSize, hop };
  const totalFrames = stftFrameCount(pcm.length, true, framing);
  const firstFrame = chunk * CHUNK_FRAMES;
  const frameCount = Math.max(0, Math.min(totalFrames, firstFrame + CHUNK_FRAMES) - firstFrame);
  const bins = fftSize / 2 + 1;
  const magnitude = new Uint8Array(frameCount * bins);
  const phaseChange = new Uint8Array(frameCount * bins);
  const rawPhase = withRawPhase ? new Uint8Array(frameCount * bins) : null;
  const previousPhase = new Float64Array(bins);
  const previousDeviation = new Float64Array(bins);
  const reference = fftSize / 4;
  const seedFrom = Math.max(0, firstFrame - SEED_FRAMES);

  forEachStftFrame(
    pcm,
    (frame, real, imag) => {
      const offset = (frame - firstFrame) * bins;
      const inChunk = frame >= firstFrame;
      for (let bin = 0; bin < bins; bin++) {
        const phase = Math.atan2(imag[bin], real[bin]);
        const deviation = wrapPhase(phase - previousPhase[bin] - (TAU * bin * hop) / fftSize);
        const change = wrapPhase(deviation - previousDeviation[bin]);
        previousPhase[bin] = phase;
        previousDeviation[bin] = deviation;
        if (!inChunk) continue;
        magnitude[offset + bin] = encodeDb(20 * Math.log10(Math.hypot(real[bin], imag[bin]) / reference + 1e-9));
        phaseChange[offset + bin] = Math.min(255, Math.round((Math.abs(change) / Math.PI) * 255));
        if (rawPhase) rawPhase[offset + bin] = Math.round(((phase + Math.PI) / TAU) * 255);
      }
    },
    true,
    { ...framing, firstFrame: seedFrom, frameCount: firstFrame + frameCount - seedFrom },
  );

  return { firstFrame, frameCount, magnitude, phaseChange, rawPhase };
}

// -- Exports ------------------------------------------------------------------

export { analyseChunk };
export type { AnalysedChunk };
