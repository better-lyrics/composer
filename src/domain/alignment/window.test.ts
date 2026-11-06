import { describe, expect, it } from "vitest";
import { alignmentWindow, refinedWindow, searchWindow, sliceWindow } from "@/domain/alignment/window";

// -- alignmentWindow ----------------------------------------------------------

describe("alignmentWindow", () => {
  it("starts 0.6 s before the tap, through the previous line's end when that end is this line's tap", () => {
    const window = alignmentWindow({ begin: 10, end: 12 }, { duration: 60, previous: { begin: 8, end: 10 } });
    expect(window.begin).toBeCloseTo(9.4);
    expect(window.end).toBeCloseTo(12.15);
  });

  it("keeps the shorter lead-in, stopped at the previous line, when that line has an end of its own", () => {
    const at = (end: number) =>
      alignmentWindow({ begin: 10, end: 12 }, { duration: 60, previous: { begin: 8, end } }).begin;
    expect(at(9.9)).toBe(9.9);
    expect(at(9)).toBeCloseTo(9.7);
  });

  it("isn't stopped by a zero-length previous line, which a jump leaves behind", () => {
    const window = alignmentWindow({ begin: 10, end: 12 }, { duration: 60, previous: { begin: 3, end: 3 } });
    expect(window.begin).toBeCloseTo(9.4);
  });

  it("stays inside the audio", () => {
    expect(alignmentWindow({ begin: 0.1, end: 59.95 }, { duration: 60 })).toEqual({ begin: 0, end: 15 });
    expect(alignmentWindow({ begin: 50, end: 59.95 }, { duration: 60 }).end).toBe(60);
  });

  it("never inverts when the taps sit past the end of the audio", () => {
    const window = alignmentWindow({ begin: 70, end: 71 }, { duration: 60 });
    expect(window.end).toBeGreaterThanOrEqual(window.begin);
  });

  it("caps a line that runs on to a tap after an instrumental break", () => {
    const window = alignmentWindow({ begin: 10, end: 95 }, { duration: 200 });
    expect(window.end - window.begin).toBeCloseTo(15);
  });
});

// -- searchWindow and refinedWindow ----------------------------------------------

describe("searchWindow", () => {
  it("looks from 1 s before the tap to 0.3 s past the end, capped like every window", () => {
    expect(searchWindow({ begin: 10, end: 12 }, 60)).toEqual({ begin: 9, end: 12.3 });
    expect(searchWindow({ begin: 10, end: 95 }, 200)).toEqual({ begin: 9, end: 24 });
  });
});

describe("refinedWindow", () => {
  const taps = { begin: 10, end: 14 };
  const plain = { begin: 9.4, end: 14.15 };
  const search = { begin: 9, end: 14.3 };

  it("moves the start to 0.3 s before the CTC start only when that start is within 0.5 s of the tap", () => {
    expect(refinedWindow(taps, plain, search, { begin: 10.45, end: 12 }).begin).toBeCloseTo(10.15);
    expect(refinedWindow(taps, plain, search, { begin: 9.55, end: 12 }).begin).toBeCloseTo(9.25);
    expect(refinedWindow(taps, plain, search, { begin: 10.55, end: 12 }).begin).toBe(9.4);
  });

  it("always ends 0.3 s after the CTC end, inside the search window", () => {
    expect(refinedWindow(taps, plain, search, { begin: 13, end: 12 }).end).toBeCloseTo(12.3);
    expect(refinedWindow(taps, plain, search, { begin: 10, end: 14.2 }).end).toBe(14.3);
  });

  it("never starts before the search window", () => {
    expect(refinedWindow({ begin: 0.2, end: 3 }, plain, { begin: 0, end: 3.3 }, { begin: 0.1, end: 2 }).begin).toBe(0);
  });

  it("keeps the plain window when the CTC found nothing, or left too little to align", () => {
    expect(refinedWindow(taps, plain, search, null)).toBe(plain);
    expect(refinedWindow(taps, plain, search, { begin: 10.55, end: 9.15 })).toBe(plain);
  });
});

// -- sliceWindow --------------------------------------------------------------

describe("sliceWindow", () => {
  it("returns the samples covering the window", () => {
    const samples = Float32Array.from({ length: 100 }, (_, i) => i);
    const slice = sliceWindow(samples, 10, { begin: 2, end: 3.5 });
    expect(slice[0]).toBe(20);
    expect(slice.length).toBe(15);
  });

  it("returns an empty slice for a window outside the audio", () => {
    expect(sliceWindow(new Float32Array(10), 10, { begin: 5, end: 6 }).length).toBe(0);
  });
});
