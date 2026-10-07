import { alignmentWindow, sliceWindow } from "@/domain/alignment/window";
import { describe, expect, it } from "vitest";

// -- alignmentWindow ----------------------------------------------------------

describe("alignmentWindow", () => {
  it("pads the tapped line on both sides", () => {
    expect(alignmentWindow({ begin: 10, end: 12 }, { pre: 0.3, post: 0.1, duration: 60 })).toEqual({
      begin: 9.7,
      end: 12.1,
    });
  });

  it("stays inside the audio", () => {
    expect(alignmentWindow({ begin: 0.1, end: 59.95 }, { pre: 0.3, post: 0.1, duration: 60 })).toEqual({
      begin: 0,
      end: 60,
    });
  });

  it("stops the start padding at the previous line but runs past the end tap", () => {
    const window = alignmentWindow(
      { begin: 10, end: 12 },
      { pre: 0.3, post: 0.15, duration: 60, previous: { begin: 8, end: 10 } },
    );
    expect(window.begin).toBe(10);
    expect(window.end).toBeCloseTo(12.15);
  });

  it("never inverts when the taps sit past the end of the audio", () => {
    const window = alignmentWindow({ begin: 70, end: 71 }, { pre: 0.3, post: 0.1, duration: 60 });
    expect(window.end).toBeGreaterThanOrEqual(window.begin);
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
