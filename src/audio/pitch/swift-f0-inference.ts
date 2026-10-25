import type { Ort, OrtSession } from "@/audio/ort-runtime";
import {
  SWIFT_F0_MAX_HZ,
  SWIFT_F0_MIN_HZ,
  frameLoudnessDb,
  inferenceWindows,
  silenceMask,
  swiftF0FrameCount,
} from "@/domain/pitch/swift-f0-frames";

// -- Types --------------------------------------------------------------------

interface PitchFrames {
  frequencyHz: Float32Array;
  confidencePercent: Uint8Array;
  loudnessDb: Int16Array;
}

// -- Functions ----------------------------------------------------------------

async function inferPitchFrames(ort: Ort, session: OrtSession, audio16k: Float32Array): Promise<PitchFrames> {
  const frameCount = swiftF0FrameCount(audio16k.length);
  const frequencyHz = new Float32Array(frameCount);
  const confidence = new Float32Array(frameCount);
  const fmin = new ort.Tensor("float32", Float32Array.of(SWIFT_F0_MIN_HZ), []);
  const fmax = new ort.Tensor("float32", Float32Array.of(SWIFT_F0_MAX_HZ), []);
  for (const window of inferenceWindows(audio16k.length)) {
    const samples = audio16k.slice(window.sampleStart, window.sampleEnd);
    const audio = new ort.Tensor("float32", samples, [1, samples.length]);
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one session runs one window at a time
    const output = await session.run({ audio, fmin, fmax });
    frequencyHz.set(output.pitch.data.subarray(window.keepFrom, window.keepTo), window.outputFrom);
    confidence.set(output.confidence.data.subarray(window.keepFrom, window.keepTo), window.outputFrom);
  }
  const silent = silenceMask(audio16k, frameCount);
  const confidencePercent = Uint8Array.from(confidence, (value, frame) =>
    silent[frame] ? 0 : Math.round(value * 100),
  );
  return { frequencyHz, confidencePercent, loudnessDb: frameLoudnessDb(audio16k, frameCount) };
}

// -- Exports ------------------------------------------------------------------

export { inferPitchFrames };
export type { PitchFrames };
