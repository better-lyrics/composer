import { initialSharing } from "@/domain/group/initial-sharing";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const chorus = (instanceIdx: number, templateLineIdx: number, begin?: number) =>
  createLine({
    id: `c${instanceIdx}-${templateLineIdx}`,
    text: "I want",
    groupId: "g1",
    instanceIdx,
    templateLineIdx,
    ...(begin === undefined
      ? {}
      : {
          words: [
            { text: "I ", begin, end: begin + 0.4 },
            { text: "want", begin: begin + 0.5, end: begin + 1 },
          ],
        }),
  });

describe("initialSharing", () => {
  const shifted = (instanceIdx: number, begin: number, secondWordShift = 0) =>
    createLine({
      id: `c${instanceIdx}-0`,
      text: "I want",
      words: [
        { text: "I ", begin, end: begin + 0.4 },
        { text: "want", begin: begin + 0.5 + secondWordShift, end: begin + 1 + secondWordShift },
      ],
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
    });

  it("gives nothing when the setting is off", () => {
    expect(initialSharing([chorus(0, 0, 10), chorus(1, 0)], "g1", false)).toEqual({});
  });

  it("shares every instance with the same relative timing", () => {
    expect(initialSharing([chorus(0, 0, 10), chorus(1, 0, 40)], "g1", true)).toEqual({ sharesTiming: true });
  });

  it("shares instances with no timing and leaves them unplaced", () => {
    expect(initialSharing([chorus(0, 0, 10), chorus(1, 0)], "g1", true)).toEqual({ sharesTiming: true });
  });

  it("gives an instance with different timing its own timing", () => {
    const lines = [shifted(0, 10), shifted(1, 40, 0.2), shifted(2, 70)];
    expect(initialSharing(lines, "g1", true)).toEqual({ sharesTiming: true, ownTimingInstances: [1] });
  });

  it("takes the first fully timed instance in line order as the source", () => {
    const partial = createLine({
      id: "c0-0",
      text: "I want",
      words: [{ text: "I ", begin: 1, end: 1.4 }],
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
    });
    const lines = [partial, shifted(1, 40, 0.2), shifted(2, 70, 0.2)];
    expect(initialSharing(lines, "g1", true)).toEqual({ sharesTiming: true, ownTimingInstances: [0] });
  });

  describe("edge cases", () => {
    it("matches within the 10 ms tolerance", () => {
      expect(initialSharing([shifted(0, 10), shifted(1, 40, 0.009)], "g1", true)).toEqual({ sharesTiming: true });
    });

    it("differs just past the 10 ms tolerance", () => {
      expect(initialSharing([shifted(0, 10), shifted(1, 40, 0.011)], "g1", true)).toEqual({
        sharesTiming: true,
        ownTimingInstances: [1],
      });
    });

    it("shares every instance when none is fully timed", () => {
      expect(initialSharing([chorus(0, 0), chorus(1, 0)], "g1", true)).toEqual({ sharesTiming: true });
    });

    it("treats a line-synced instance and a word-synced instance as different", () => {
      const lineSynced = createLine({
        id: "c1-0",
        text: "I want",
        begin: 40,
        end: 41,
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
      });
      expect(initialSharing([chorus(0, 0, 10), lineSynced], "g1", true)).toEqual({
        sharesTiming: true,
        ownTimingInstances: [1],
      });
    });

    it("ignores detached lines", () => {
      const lines = [
        chorus(0, 0, 10),
        chorus(1, 0, 40),
        { ...shifted(1, 40, 0.3), id: "d", templateLineIdx: 1, detached: true },
      ];
      expect(initialSharing(lines, "g1", true)).toEqual({ sharesTiming: true });
    });
  });

  describe("invariants", () => {
    it("never writes timing", () => {
      const lines = [shifted(0, 10), shifted(1, 40, 0.2)];
      const snapshot = structuredClone(lines);
      initialSharing(lines, "g1", true);
      expect(lines).toEqual(snapshot);
    });
  });
});
