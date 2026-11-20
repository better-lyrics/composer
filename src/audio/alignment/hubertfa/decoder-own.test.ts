import { describe, expect, it } from "vitest";
import { decodeAlignment } from "@/audio/alignment/hubertfa/decoder";

// The decoder with the lyric neighbours' words around the line's, the begin tap as a soft hint and a "this line"
// gate, against hubertfa-posttrain's hfapt/nb_decode.py (align_logits with start_prior and line) on the same logits.

// -- Helpers ------------------------------------------------------------------

const VOCAB = 8;
const FRAMES = 240;
const HOP = 441;

interface Case {
  before: number[][];
  own: number[][];
  after: number[][];
  /** (phone, first frame, end frame) sung in the window. */
  segs: number[][];
  /** The begin tap's frame; the hint runs from 45 frames before it to 15 after, at 0.5 a frame. */
  tap: number | null;
  /** The gate: (first frame, end frame) its logits call the line's, its weight and its clip. */
  gate: number[] | null;
  seed: number;
  amp: number;
  /** nb_decode's (begin, end) of each of the line's phones, rounded to 4 places. */
  spans: number[][];
}

// Noise over every class, each sung phone louder over its frames, silence louder elsewhere, edges at the changes.
function logits({ segs, seed, amp }: Case) {
  const frameLogits = new Float32Array(VOCAB * FRAMES);
  for (let v = 0; v < VOCAB; v++) {
    for (let t = 0; t < FRAMES; t++)
      frameLogits[v * FRAMES + t] = amp * Math.sin(v * 12.9898 + t * 78.233 + seed * 3.7);
  }
  const edgeLogits = new Float32Array(FRAMES).fill(-4);
  const free = new Uint8Array(FRAMES).fill(1);
  for (const [phone, a, b] of segs) {
    for (let t = a; t < b; t++) {
      frameLogits[phone * FRAMES + t] += 6;
      free[t] = 0;
    }
    edgeLogits[a] += 8;
    if (b < FRAMES) edgeLogits[b] += 8;
  }
  for (let t = 0; t < FRAMES; t++) if (free[t]) frameLogits[t] += 4;
  return { frameLogits, edgeLogits };
}

// 4 inside the gate's span and -4 outside, with a ripple.
function gateOf(gate: number[] | null) {
  if (!gate) return undefined;
  const [from, to, weight, clip] = gate;
  const z = Float32Array.from({ length: FRAMES }, (_, t) => (t >= from && t < to ? 4 : -4) + Math.sin(0.37 * t + from));
  return { logits: z, weight, clip };
}

// SP, each word's phones, SP, ...; and which sequence positions are the line's own phones.
function sequence({ before, own, after }: Case) {
  const ids = [0];
  const mine: number[] = [];
  [...before, ...own, ...after].forEach((word, w) => {
    for (const phone of word) {
      if (w >= before.length && w < before.length + own.length) mine.push(ids.length);
      ids.push(phone);
    }
    ids.push(0);
  });
  return { phoneIds: Int32Array.from(ids), mine };
}

function input(c: Case) {
  const { phoneIds } = sequence(c);
  return {
    ...logits(c),
    vocabSize: VOCAB,
    frames: FRAMES,
    numSamples: FRAMES * HOP,
    sampleRate: 44100,
    hopSize: HOP,
    phoneIds,
  };
}

// biome-ignore format: one reference case a line
const CASES: Case[] = [
  { before: [[1, 2]], own: [[3], [4]], after: [[5]], segs: [[1, 20, 40], [2, 40, 60], [3, 100, 120], [4, 120, 140], [5, 180, 200]], tap: 110, gate: null, seed: 0, amp: 2, spans: [[0.9952, 1.1951], [1.21, 1.3952]] },
  { before: [[1, 2]], own: [[3], [4]], after: [[5]], segs: [[1, 20, 40], [2, 40, 60], [3, 100, 120], [4, 120, 140], [5, 180, 200]], tap: 20, gate: null, seed: 1, amp: 2, spans: [[0.9952, 1.1951], [1.21, 1.3952]] },
  { before: [], own: [[3], [4]], after: [], segs: [[3, 30, 50], [4, 50, 70], [3, 130, 150], [4, 150, 170]], tap: 40, gate: null, seed: 2, amp: 2, spans: [[0.2952, 0.4951], [1.31, 1.6952]] },
  { before: [], own: [[3], [4]], after: [], segs: [[3, 30, 50], [4, 50, 70], [3, 130, 150], [4, 150, 170]], tap: 140, gate: null, seed: 2, amp: 2, spans: [[1.2952, 1.4951], [1.51, 1.6952]] },
  { before: [[1], [2, 3]], own: [[4, 5], [6]], after: [[7, 1]], segs: [], tap: null, gate: null, seed: 6, amp: 3, spans: [[1.45, 1.46], [1.46, 1.49], [2.39, 2.4]] },
  { before: [[2, 3]], own: [[3, 4], [4]], after: [[4, 5]], segs: [[2, 10, 30], [3, 30, 60], [3, 80, 100], [4, 100, 130], [4, 150, 170], [4, 190, 210], [5, 210, 230]], tap: 85, gate: null, seed: 7, amp: 2, spans: [[0.7952, 0.9951], [0.9951, 1.2952], [1.4952, 1.6952]] },
  { before: [], own: [[3], [4]], after: [], segs: [[3, 30, 50], [4, 50, 70], [3, 130, 150], [4, 150, 170]], tap: 40, gate: [130, 170, 0.5, 6], seed: 2, amp: 2, spans: [[1.2952, 1.4951], [1.51, 1.6952]] },
  { before: [], own: [[3], [4]], after: [], segs: [[3, 30, 50], [4, 50, 70], [3, 130, 150], [4, 150, 170]], tap: 40, gate: [130, 170, 4, 6], seed: 2, amp: 2, spans: [[1.2948, 1.4951], [1.51, 1.6948]] },
  { before: [], own: [[3], [4]], after: [], segs: [[3, 30, 50], [4, 50, 70], [3, 130, 150], [4, 150, 170]], tap: null, gate: [125, 175, 0.5, 6], seed: 2, amp: 2, spans: [[1.2952, 1.4951], [1.51, 1.6952]] },
  { before: [[1, 2]], own: [[3], [4]], after: [[5]], segs: [[1, 20, 40], [2, 40, 60], [3, 100, 120], [4, 120, 140], [5, 180, 200]], tap: 20, gate: [100, 140, 0.5, 6], seed: 1, amp: 2, spans: [[0.9952, 1.1951], [1.21, 1.3952]] },
  { before: [[1, 2]], own: [[3], [4]], after: [[5]], segs: [[1, 20, 40], [2, 40, 60], [3, 100, 120], [4, 120, 140], [5, 180, 200]], tap: 20, gate: [100, 140, 8, 2], seed: 1, amp: 2, spans: [[0.9948, 1.1951], [1.21, 1.3948]] },
  { before: [[2, 3]], own: [[3, 4], [4]], after: [[4, 5]], segs: [[2, 10, 30], [3, 30, 60], [3, 80, 100], [4, 100, 130], [4, 150, 170], [4, 190, 210], [5, 210, 230]], tap: 85, gate: [30, 130, 1, 3], seed: 7, amp: 2, spans: [[0.31, 0.9951], [0.9951, 1.01], [1.01, 1.2952]] },
  { before: [[1], [2, 3]], own: [[4, 5], [6]], after: [[7, 1]], segs: [], tap: 100, gate: [90, 160, 0.5, 6], seed: 5, amp: 3, spans: [[0.9, 0.92], [0.92, 0.94], [1.56, 1.58]] },
];

// -- Tests --------------------------------------------------------------------

describe("decodeAlignment with the line's neighbours", () => {
  it("matches the Python reference, with and without the tap hint and the gate", () => {
    const found = CASES.map((c) => {
      const { mine } = sequence(c);
      const hint = c.tap === null ? undefined : { from: c.tap - 45, to: c.tap + 15, cost: 0.5 };
      const own = { first: mine[0], last: mine[mine.length - 1], hint, gate: gateOf(c.gate) };
      return decodeAlignment({ ...input(c), own })
        ?.filter((p) => mine.includes(p.index))
        .map((p) => [Number(p.begin.toFixed(4)), Number(p.end.toFixed(4))]);
    });
    expect(found).toEqual(CASES.map((c) => c.spans));
  });

  it("is the plain decoder when the line has no neighbours, hint or gate", () => {
    for (const c of CASES.filter((x) => x.before.length + x.after.length === 0)) {
      const { mine } = sequence(c);
      expect(decodeAlignment({ ...input(c), own: { first: mine[0], last: mine[mine.length - 1] } })).toEqual(
        decodeAlignment(input(c)),
      );
    }
  });
});
