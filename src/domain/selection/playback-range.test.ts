import { playbackRange } from "@/domain/selection/playback-range";
import { describe, expect, it } from "vitest";

const selection = { begin: 10, end: 11 };
const focus = { begin: 5, end: 20 };

describe("playbackRange", () => {
  it("pads the selection with the lead-in on both sides", () => {
    expect(playbackRange({ selection, focus: null, leadIn: 0.3, duration: 60 })).toEqual({ begin: 9.7, end: 11.3 });
  });

  it("prefers the selection over an open group", () => {
    expect(playbackRange({ selection, focus, leadIn: 0, duration: 60 })).toEqual(selection);
  });

  it("falls back to the open group, exact, when no selection plays", () => {
    expect(playbackRange({ selection: null, focus, leadIn: 0.3, duration: 60 })).toEqual(focus);
  });

  it("returns null with neither", () => {
    expect(playbackRange({ selection: null, focus: null, leadIn: 0.3, duration: 60 })).toBeNull();
  });

  describe("edge cases", () => {
    it("zero lead-in plays the exact selection", () => {
      expect(playbackRange({ selection, focus: null, leadIn: 0, duration: 60 })).toEqual(selection);
    });

    it("clamps the lead-in at the song start", () => {
      const early = { begin: 0.1, end: 0.5 };
      expect(playbackRange({ selection: early, focus: null, leadIn: 0.3, duration: 60 })?.begin).toBe(0);
    });

    it("clamps the tail at the song end", () => {
      const late = { begin: 59.5, end: 59.9 };
      expect(playbackRange({ selection: late, focus: null, leadIn: 0.3, duration: 60 })?.end).toBe(60);
    });

    it("does not clamp the tail while the duration is unknown", () => {
      expect(playbackRange({ selection, focus: null, leadIn: 0.3, duration: 0 })?.end).toBeCloseTo(11.3);
    });
  });
});
