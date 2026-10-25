import { describe, expect, it } from "vitest";
import { EMPTY_TAPS, isValidBpm, sanitizeBpmInput, tapTempo } from "@/domain/tempo/tap-tempo";

function tapEvery(gapMs: number, count: number, start = 1000) {
  let state = EMPTY_TAPS;
  for (let i = 0; i < count; i++) state = tapTempo(state, start + i * gapMs);
  return state;
}

describe("tapTempo", () => {
  it("has no tempo after one tap", () => {
    expect(tapTempo(EMPTY_TAPS, 1000).bpm).toBeNull();
  });

  it("averages the gaps between taps", () => {
    expect(tapEvery(735, 6).bpm).toBe(81.6);
    expect(tapEvery(500, 3).bpm).toBe(120);
  });

  it("starts over after a pause longer than 2 s", () => {
    const state = tapTempo(tapEvery(500, 4), 1000 + 3 * 500 + 2001);
    expect(state.taps).toHaveLength(1);
    expect(state.bpm).toBeNull();
  });

  it("keeps a 2 s pause", () => {
    expect(tapTempo(tapEvery(500, 2), 1000 + 500 + 2000).taps).toHaveLength(3);
  });

  it("keeps only the last 9 taps", () => {
    const state = tapEvery(500, 10);
    expect(state.taps).toHaveLength(9);
    expect(state.taps[0]).toBe(1500);
  });
});

describe("sanitizeBpmInput", () => {
  it("turns a comma into a decimal point and keeps one decimal", () => {
    expect(sanitizeBpmInput("128,57")).toBe("128.5");
  });

  it("keeps at most three integer digits", () => {
    expect(sanitizeBpmInput("81281.6")).toBe("812.6");
  });

  it("drops everything that is not a digit or a point", () => {
    expect(sanitizeBpmInput("abc")).toBe("");
    expect(sanitizeBpmInput("9 0 bpm")).toBe("90");
  });
});

describe("isValidBpm", () => {
  it("accepts 30 to 300", () => {
    expect(isValidBpm(29.9)).toBe(false);
    expect(isValidBpm(30)).toBe(true);
    expect(isValidBpm(300)).toBe(true);
    expect(isValidBpm(300.1)).toBe(false);
    expect(isValidBpm(Number.NaN)).toBe(false);
  });
});
