// -- Types --------------------------------------------------------------------

interface InferenceWindow {
  sampleStart: number;
  sampleEnd: number;
  keepFrom: number;
  keepTo: number;
  outputFrom: number;
}

// -- Constants ----------------------------------------------------------------

const SWIFT_F0_SAMPLE_RATE = 16000;
const SWIFT_F0_HOP = 256;
const SWIFT_F0_MIN_HZ = 46.875;
const SWIFT_F0_MAX_HZ = 2093.75;
const LOOKAHEAD_FRAMES = 10;
const LEFT_FRAMES = 11;
const WINDOW_FRAMES = 1875;
const SILENCE_PEAK = 1e-3;
const LOUDNESS_FLOOR = 1e-7;

// -- Functions ----------------------------------------------------------------

function swiftF0FrameCount(sampleCount: number): number {
  return Math.max(1, Math.floor(sampleCount / SWIFT_F0_HOP));
}

// Each window carries enough context on both sides that stitched windows match one long run.
function inferenceWindows(sampleCount: number): InferenceWindow[] {
  const frames = swiftF0FrameCount(sampleCount);
  const windows: InferenceWindow[] = [];
  for (let start = 0; start < frames; start += WINDOW_FRAMES) {
    const end = Math.min(start + WINDOW_FRAMES, frames);
    const left = Math.max(0, start - LEFT_FRAMES);
    windows.push({
      sampleStart: left * SWIFT_F0_HOP,
      sampleEnd: end < frames ? Math.min(sampleCount, (end + LOOKAHEAD_FRAMES) * SWIFT_F0_HOP) : sampleCount,
      keepFrom: start - left,
      keepTo: end - left,
      outputFrom: start,
    });
  }
  return windows;
}

function hopEnd(audio: Float32Array, frame: number, frameCount: number): number {
  return frameCount === 1 && audio.length < SWIFT_F0_HOP ? audio.length : (frame + 1) * SWIFT_F0_HOP;
}

function frameLoudnessDb(audio: Float32Array, frameCount: number): Int16Array {
  const loudness = new Int16Array(frameCount);
  let previous = 0;
  for (let frame = 0; frame < frameCount; frame++) {
    let power = 0;
    for (let i = frame * SWIFT_F0_HOP, end = hopEnd(audio, frame, frameCount); i < end; i++)
      power += audio[i] * audio[i];
    loudness[frame] = Math.round(20 * Math.log10(Math.max(Math.sqrt((previous + power) / 512), LOUDNESS_FLOOR)));
    previous = power;
  }
  return loudness;
}

function silenceMask(audio: Float32Array, frameCount: number): Uint8Array {
  const silent = new Uint8Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    let peak = 0;
    for (let i = frame * SWIFT_F0_HOP, end = hopEnd(audio, frame, frameCount); i < end; i++) {
      peak = Math.max(peak, Math.abs(audio[i]));
    }
    silent[frame] = peak < SILENCE_PEAK ? 1 : 0;
  }
  return silent;
}

// -- Exports ------------------------------------------------------------------

export {
  SWIFT_F0_HOP,
  SWIFT_F0_MAX_HZ,
  SWIFT_F0_MIN_HZ,
  SWIFT_F0_SAMPLE_RATE,
  frameLoudnessDb,
  inferenceWindows,
  silenceMask,
  swiftF0FrameCount,
};
