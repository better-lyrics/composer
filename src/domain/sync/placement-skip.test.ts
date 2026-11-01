import { placementSkipTarget } from "@/domain/sync/placement-skip";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const chorus2 = [
  createLine({
    id: "c2a",
    text: "Hold me",
    groupId: "g",
    instanceIdx: 1,
    words: [{ text: "Hold me", begin: 94, end: 100 }],
  }),
  createLine({
    id: "c2b",
    text: "close",
    groupId: "g",
    instanceIdx: 1,
    words: [{ text: "close", begin: 101, end: 114 }],
    backgroundText: "ooh",
    backgroundWords: [{ text: "ooh", begin: 110, end: 113 }],
  }),
];
const chorus1 = [
  createLine({
    id: "c1",
    text: "Hold me",
    groupId: "g",
    instanceIdx: 0,
    words: [{ text: "Hold me", begin: 30, end: 50 }],
  }),
];
const lines = [...chorus1, ...chorus2, createLine({ id: "bridge", text: "Bridge" })];

describe("placementSkipTarget", () => {
  it("lands the pre-roll before the placed instance ends", () => {
    expect(placementSkipTarget(lines, "g", 1, 94, 1.5)).toEqual({ seekTo: 112.5, end: 114 });
  });

  it("measures the end across main and background vocals", () => {
    const bgLast = lines.map((line) =>
      line.id === "c2b" ? { ...line, backgroundWords: [{ text: "ooh", begin: 110, end: 116 }] } : line,
    );
    expect(placementSkipTarget(bgLast, "g", 1, 94, 1.5)).toEqual({ seekTo: 114.5, end: 116 });
  });

  describe("edge cases", () => {
    it("does not skip when the instance ends within the pre-roll of the tap", () => {
      expect(placementSkipTarget(lines, "g", 1, 113, 1.5)).toBeNull();
      expect(placementSkipTarget(lines, "g", 1, 112.5, 1.5)).toBeNull();
    });

    it("skips to the very end with no pre-roll", () => {
      expect(placementSkipTarget(lines, "g", 1, 94, 0)).toEqual({ seekTo: 114, end: 114 });
    });

    it("does not skip for an unknown instance", () => {
      expect(placementSkipTarget(lines, "g", 7, 94, 1.5)).toBeNull();
      expect(placementSkipTarget(lines, "other", 1, 94, 1.5)).toBeNull();
    });

    it("does not skip for an instance with no timing yet", () => {
      const untimed = [createLine({ id: "u", text: "Hold me", groupId: "g", instanceIdx: 2 })];
      expect(placementSkipTarget(untimed, "g", 2, 10, 1.5)).toBeNull();
    });
  });

  describe("invariants", () => {
    it("always lands the pre-roll before the end it reports", () => {
      const skip = placementSkipTarget(lines, "g", 1, 94, 1.5);
      expect(skip && skip.end - skip.seekTo).toBe(1.5);
    });

    it("never seeks backwards", () => {
      for (const tapTime of [0, 50, 94, 100, 112, 112.4, 112.5, 120]) {
        const skip = placementSkipTarget(lines, "g", 1, tapTime, 1.5);
        if (skip !== null) expect(skip.seekTo).toBeGreaterThan(tapTime);
      }
    });
  });
});
