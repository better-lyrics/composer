import {
  SWIFT_F0_HOP,
  frameLoudnessDb,
  inferenceWindows,
  silenceMask,
  swiftF0FrameCount,
} from "@/domain/pitch/swift-f0-frames";
import golden from "@/domain/pitch/test-fixtures/swift-f0-frames-golden.json";
import { describe, expect, it } from "vitest";

function syntheticSignal(): Float32Array {
  const { sampleRate, seconds } = golden.signal;
  return Float32Array.from({ length: Math.floor(seconds * sampleRate) }, (_, i) => {
    const t = i / sampleRate;
    if (t < 1) return 0.3 * Math.sin(2 * Math.PI * 220 * t);
    if (t >= 1.5) return 0.3 * Math.sin(2 * Math.PI * 330 * t);
    return 0;
  });
}

describe("SwiftF0 framing matches the Python package", () => {
  it("splits long audio into the same inference windows", () => {
    for (const [length, expected] of Object.entries(golden.windows)) {
      const windows = inferenceWindows(Number(length)).map((w) => [
        w.sampleStart,
        w.sampleEnd,
        w.keepFrom,
        w.keepTo,
        w.outputFrom,
      ]);
      expect(windows).toEqual(expected);
    }
  });

  it("marks the same silent frames and gives the same loudness", () => {
    const signal = syntheticSignal();
    const frames = swiftF0FrameCount(signal.length);
    expect(Array.from(silenceMask(signal, frames))).toEqual(golden.silent);
    const loudness = frameLoudnessDb(signal, frames);
    golden.loudnessDb.forEach((db, frame) => expect(Math.abs(loudness[frame] - db)).toBeLessThanOrEqual(1));
  });

  describe("edge cases", () => {
    it("treats audio shorter than one hop as one frame", () => {
      const tiny = new Float32Array(SWIFT_F0_HOP - 1).fill(0.5);
      expect(swiftF0FrameCount(tiny.length)).toBe(1);
      expect(silenceMask(tiny, 1)[0]).toBe(0);
    });
  });
});
