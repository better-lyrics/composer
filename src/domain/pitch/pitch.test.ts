import { pitchRangeBetween } from "@/domain/pitch/line-range";
import { isCovered, spillRuns, wordCoverage } from "@/domain/pitch/spill";
import slice from "@/domain/pitch/test-fixtures/pitch-mascara-slice.json";
import { type PitchPoint, type PitchTrack, frameAt, isVoicedFrame } from "@/domain/pitch/track";
import { backgroundLaneRuns, voicedRuns } from "@/domain/pitch/voiced-runs";
import { describe, expect, it } from "vitest";

function trackFromJson(json: { hop: number; t0: number; f0: number[]; conf: number[]; db: number[] }): PitchTrack {
  return {
    hopSeconds: json.hop,
    startSeconds: json.t0,
    frequencyHz: Float32Array.from(json.f0),
    confidencePercent: Uint8Array.from(json.conf),
    loudnessDb: Int16Array.from(json.db),
  };
}

function syntheticTrack(frequencies: number[], hopSeconds = 0.016, startSeconds = 0): PitchTrack {
  return {
    hopSeconds,
    startSeconds,
    frequencyHz: Float32Array.from(frequencies),
    confidencePercent: Uint8Array.from(frequencies, (hz) => (hz > 0 ? 90 : 0)),
    loudnessDb: Int16Array.from(frequencies, (hz) => (hz > 0 ? -20 : -90)),
  };
}

function runFrom(beginSeconds: number, endSeconds: number, step = 0.016): PitchPoint[] {
  const points: PitchPoint[] = [];
  for (let seconds = beginSeconds; seconds <= endSeconds + 1e-9; seconds += step)
    points.push({ seconds, semitones: 40 });
  return points;
}

const track = trackFromJson(slice);
const sliceStart = slice.t0;
const sliceEnd = slice.t0 + slice.f0.length * slice.hop;

describe("pitch track", () => {
  it("finds voiced runs in real singing, made only of voiced frames", () => {
    const runs = voicedRuns(track, sliceStart, sliceEnd);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) {
      for (const point of run) expect(isVoicedFrame(track, frameAt(track, point.seconds))).toBe(true);
    }
  });

  it("gives a line range of at least 6 semitones", () => {
    const range = pitchRangeBetween(track, sliceStart, sliceEnd);
    expect(range.low).toBeLessThan(range.high);
    expect(range.high - range.low).toBeGreaterThanOrEqual(6);
  });

  describe("edge cases", () => {
    it("falls back when nothing in the window is voiced", () => {
      const silent = syntheticTrack([0, 0, 0, 0, 0]);
      expect(pitchRangeBetween(silent, 0, 1)).toEqual({ low: 40, high: 46 });
    });

    it("splits a run at a jump bigger than 5 semitones", () => {
      const fifth = 220 * 2 ** (7 / 12);
      const jumpy = syntheticTrack([220, 220, 220, 220, 220, fifth, fifth, fifth, fifth, fifth]);
      expect(voicedRuns(jumpy, 0, 1)).toHaveLength(2);
    });
  });
});

describe("spill", () => {
  it("marks singing past the last word and nothing once a word covers it", () => {
    const run = runFrom(sliceStart + 0.5, sliceStart + 1.3);
    const short = spillRuns([run], wordCoverage([{ begin: sliceStart, end: sliceStart + 1 }]));
    expect(short).toHaveLength(1);
    expect(short[0][0].seconds).toBeCloseTo(sliceStart + 1, 1);
    expect(spillRuns([run], wordCoverage([{ begin: sliceStart, end: sliceStart + 2 }]))).toHaveLength(0);
  });

  it("keeps background lane points only outside lead words", () => {
    const run = runFrom(0, 1);
    const [kept] = backgroundLaneRuns([run], [{ begin: 0.2, end: 0.6 }]);
    expect(kept.every((point) => point.seconds < 0.2 || point.seconds >= 0.6)).toBe(true);
    expect(kept.length).toBeGreaterThan(0);
  });

  describe("invariants", () => {
    it("isCovered agrees with a linear scan over overlapping spans", () => {
      const spans = [
        { begin: 0.3, end: 1.1 },
        { begin: 0.9, end: 1.4 },
        { begin: 2, end: 2.05 },
        { begin: 3.5, end: 3.2 },
        { begin: 4, end: 6 },
        { begin: 4.5, end: 5 },
        { begin: 7.25, end: 7.75 },
      ];
      const coverage = wordCoverage(spans);
      for (let i = 0; i < 1000; i++) {
        const seconds = (i * 7.919) % 8;
        const linear = spans.some((span) => seconds >= span.begin && seconds < span.end);
        expect(isCovered(coverage, seconds)).toBe(linear);
      }
    });
  });
});
