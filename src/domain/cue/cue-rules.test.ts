import { cueAfterPlacement, transportPosition } from "@/domain/cue/cue-rules";
import { describe, expect, it } from "vitest";

describe("cueAfterPlacement", () => {
  it("a click or drag sets the cue, playing or not", () => {
    expect(cueAfterPlacement({ cue: 1, time: 4, kind: "pointer", playing: true })).toBe(4);
    expect(cueAfterPlacement({ cue: null, time: 4, kind: "pointer", playing: false })).toBe(4);
  });

  it("a keyboard placement sets the cue only while paused", () => {
    expect(cueAfterPlacement({ cue: 1, time: 4, kind: "keyboard", playing: false })).toBe(4);
    expect(cueAfterPlacement({ cue: 1, time: 4, kind: "keyboard", playing: true })).toBe(1);
  });

  describe("edge cases", () => {
    it("a keyboard placement while playing leaves no cue when there was none", () => {
      expect(cueAfterPlacement({ cue: null, time: 4, kind: "keyboard", playing: true })).toBeNull();
    });

    it("a placement at the song start is a real cue", () => {
      expect(cueAfterPlacement({ cue: 3, time: 0, kind: "pointer", playing: false })).toBe(0);
    });
  });
});

describe("transport with the Return to cue latch", () => {
  it("plays from the cue when latched, even if paused elsewhere", () => {
    expect(transportPosition({ latched: true, cue: 2, playhead: 9 })).toBe(2);
  });

  it("plays in place when not latched or without a cue", () => {
    expect(transportPosition({ latched: false, cue: 2, playhead: 9 })).toBe(9);
    expect(transportPosition({ latched: true, cue: null, playhead: 9 })).toBe(9);
  });

  it("stops back on the cue only when latched, since play and stop share one rule", () => {
    expect(transportPosition({ latched: true, cue: 2, playhead: 9 })).toBe(2);
    expect(transportPosition({ latched: false, cue: 2, playhead: 9 })).toBe(9);
    expect(transportPosition({ latched: true, cue: null, playhead: 9 })).toBe(9);
  });

  it("treats a cue at 0 as a cue", () => {
    expect(transportPosition({ latched: true, cue: 0, playhead: 9 })).toBe(0);
    expect(transportPosition({ latched: true, cue: 0, playhead: 9 })).toBe(0);
  });
});
