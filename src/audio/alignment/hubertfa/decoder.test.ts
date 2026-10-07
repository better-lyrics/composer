import { decodeAlignment } from "@/audio/alignment/hubertfa/decoder";
import { describe, expect, it } from "vitest";

// A tiny vocabulary: 0 = silence, 1 and 2 = phones. The logits make silence
// win frames 0-2, phone 1 frames 3-5 and phone 2 frames 6-9, with edges at
// the two changes.
function scenario() {
  const vocabSize = 3;
  const frames = 10;
  const owner = [0, 0, 0, 1, 1, 1, 2, 2, 2, 2];
  const frameLogits = new Float32Array(vocabSize * frames);
  for (let t = 0; t < frames; t++) {
    for (let v = 0; v < vocabSize; v++) frameLogits[v * frames + t] = v === owner[t] ? 8 : -8;
  }
  const edgeLogits = Float32Array.from(owner, (o, t) => (t > 0 && owner[t - 1] !== o ? 6 : -6));
  return { vocabSize, frames, frameLogits, edgeLogits, sampleRate: 1000, hopSize: 100, numSamples: 1000 };
}

describe("decodeAlignment", () => {
  // Expected values come from running the same input through HubertFA's
  // Python decoder, which this port has to reproduce exactly.
  it("matches the reference decoder", () => {
    const phones = decodeAlignment({ ...scenario(), phoneIds: Int32Array.from([0, 1, 2, 0]) });
    expect(phones?.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(phones?.map((p) => [p.begin, p.end].map((x) => Number(x.toFixed(3))))).toEqual([
      [0, 0.25],
      [0.25, 0.4],
      [0.4, 1],
    ]);
  });

  it("can skip an optional silence", () => {
    const phones = decodeAlignment({ ...scenario(), phoneIds: Int32Array.from([0, 1, 0, 2, 0]) });
    expect(phones?.some((p) => p.index === 2)).toBe(false);
    expect(phones?.map((p) => p.index)).toContain(3);
  });

  it("returns nothing for an empty sequence", () => {
    expect(decodeAlignment({ ...scenario(), phoneIds: new Int32Array(0) })).toBeNull();
  });
});
