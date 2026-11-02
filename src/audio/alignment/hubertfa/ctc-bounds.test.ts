import { ctcLineBounds } from "@/audio/alignment/hubertfa/ctc-bounds";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const VOCAB = 12;
const FRAMES = 40;
const HOP = 441;

// Logits both this test and the Python reference compute: noise over every
// class, and each phone louder over three frames of its own.
function logits(tokens: number[], seed: number): Float32Array {
  const x = new Float32Array(VOCAB * FRAMES);
  for (let v = 0; v < VOCAB; v++) {
    for (let t = 0; t < FRAMES; t++) x[v * FRAMES + t] = 3 * Math.sin(v * 12.9898 + t * 78.233 + seed * 3.7);
  }
  tokens.forEach((v, k) => {
    for (let t = 8 + 4 * k; t < 11 + 4 * k; t++) x[v * FRAMES + t] += 5;
  });
  return x;
}

// -- Tests --------------------------------------------------------------------

describe("ctcLineBounds", () => {
  // Expected frames from hubertfa-posttrain's step-1 ctc_bounds (hfapt/step1.py, blank 0, softmax over the
  // blank and the line's phones only) on the same logits.
  it("matches the Python reference the window refinement was validated with", () => {
    const cases: [number[], [number, number]][] = [
      [
        [3, 5, 5, 2, 7],
        [2, 36],
      ],
      [
        [4, 4, 4],
        [5, 37],
      ],
      [
        [9, 1, 6, 1, 9, 2],
        [1, 36],
      ],
      [[2], [7, 28]],
      [
        [11, 10],
        [5, 35],
      ],
    ];
    const found = cases.map(([tokens], seed) => {
      const bounds = ctcLineBounds({
        logits: logits(tokens, seed),
        outputFrames: FRAMES,
        numSamples: FRAMES * HOP,
        hopSize: HOP,
        phoneIds: Int32Array.from(tokens),
      });
      return bounds && [bounds.first, bounds.end];
    });
    expect(found).toEqual(cases.map(([, expected]) => expected));
  });

  it("finds nothing when the phones can't fit in the window", () => {
    const input = { logits: logits([1, 2], 0), outputFrames: FRAMES, hopSize: HOP, phoneIds: Int32Array.from([1, 2]) };
    expect(ctcLineBounds({ ...input, numSamples: HOP })).toBeNull();
  });
});
