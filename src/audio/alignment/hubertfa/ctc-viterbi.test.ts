import { ctcViterbi } from "@/audio/alignment/hubertfa/ctc-viterbi";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

// Emissions from per-frame probabilities over [blank, a, b].
function emissions(frames: number[][]) {
  return {
    logProbs: Float32Array.from(frames.flat(), Math.log),
    frames: frames.length,
    classes: frames[0].length,
  };
}

const A = [0.05, 0.9, 0.05];
const B = [0.05, 0.05, 0.9];
const BLANK = [0.9, 0.05, 0.05];

// -- Tests --------------------------------------------------------------------

describe("ctcViterbi", () => {
  it("puts each phone on the frames that spike it", () => {
    const spans = ctcViterbi(emissions([BLANK, A, A, BLANK, BLANK, B, BLANK]), Int32Array.from([1, 2]));
    expect(spans?.map(({ first, last }) => [first, last])).toEqual([
      [1, 2],
      [5, 5],
    ]);
    expect(spans?.[0].logProbSum).toBeCloseTo(2 * Math.log(0.9));
  });

  it("separates a repeated phone with a blank, as CTC must", () => {
    const spans = ctcViterbi(emissions([A, A, A, BLANK, A, A]), Int32Array.from([1, 1]));
    const [first, second] = spans ?? [];
    expect(first.last).toBeLessThan(second.first - 1);
  });

  it("aligns only within the given frames", () => {
    const spans = ctcViterbi(emissions([A, BLANK, BLANK, BLANK, A, BLANK]), Int32Array.from([1]), 2, 6);
    expect(spans?.[0].first).toBe(4);
  });

  it("returns null when the phones can't fit", () => {
    expect(ctcViterbi(emissions([A, A]), Int32Array.from([1, 1]))).toBeNull();
  });
});
