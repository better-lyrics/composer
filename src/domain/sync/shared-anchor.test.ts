import { createGroup, createLine } from "@/test/factories";
import { sharedAnchorAt } from "@/domain/sync/shared-anchor";
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

const verse = (id: string) => createLine({ id, text: "Walking home" });
const sharing = [createGroup({ id: "g1", sharesTiming: true })];
const song = (secondBegin?: number) => [
  chorus(0, 0, 10),
  chorus(0, 1, 11),
  verse("v1"),
  chorus(1, 0, secondBegin),
  chorus(1, 1, secondBegin === undefined ? undefined : secondBegin + 1),
  verse("v2"),
];

describe("sharedAnchorAt", () => {
  it("finds the first word of a later shared instance", () => {
    expect(sharedAnchorAt(song(), sharing, { lineIndex: 3, wordIndex: 0 })).toEqual({
      groupId: "g1",
      instanceIdx: 1,
      resumeLineIndex: 5,
    });
  });

  it("finds an instance that is already placed, so one tap moves it", () => {
    expect(sharedAnchorAt(song(40), sharing, { lineIndex: 3, wordIndex: 0 })?.instanceIdx).toBe(1);
  });

  it("finds an unplaced first instance when a later one holds the timing", () => {
    const lines = [chorus(0, 0), chorus(0, 1), verse("v1"), chorus(1, 0, 40), chorus(1, 1, 41)];
    expect(sharedAnchorAt(lines, sharing, { lineIndex: 0, wordIndex: 0 })?.resumeLineIndex).toBe(2);
  });

  describe("edge cases", () => {
    it("is null past the first word", () => {
      expect(sharedAnchorAt(song(), sharing, { lineIndex: 3, wordIndex: 1 })).toBeNull();
    });

    it("is null on a later line of the instance", () => {
      expect(sharedAnchorAt(song(), sharing, { lineIndex: 4, wordIndex: 0 })).toBeNull();
    });

    it("is null on a line outside any group", () => {
      expect(sharedAnchorAt(song(), sharing, { lineIndex: 2, wordIndex: 0 })).toBeNull();
    });

    it("is null for an old group", () => {
      expect(sharedAnchorAt(song(), [createGroup({ id: "g1" })], { lineIndex: 3, wordIndex: 0 })).toBeNull();
    });

    it("is null for an own-timing instance", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      expect(sharedAnchorAt(song(), groups, { lineIndex: 3, wordIndex: 0 })).toBeNull();
    });

    it("is null when no other shared instance is fully timed", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1), chorus(1, 0), chorus(1, 1)];
      expect(sharedAnchorAt(lines, sharing, { lineIndex: 2, wordIndex: 0 })).toBeNull();
    });

    it("is null for the first instance in the song once it has timing", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1), chorus(1, 0, 40), chorus(1, 1, 41)];
      expect(sharedAnchorAt(lines, sharing, { lineIndex: 0, wordIndex: 0 })).toBeNull();
    });

    it("is null past the end of the song", () => {
      expect(sharedAnchorAt(song(), sharing, { lineIndex: 6, wordIndex: 0 })).toBeNull();
    });

    it("gives the song length when the instance ends the song", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0)];
      expect(sharedAnchorAt(lines, sharing, { lineIndex: 1, wordIndex: 0 })?.resumeLineIndex).toBe(2);
    });

    it("resumes at a detached line inside the instance", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 11), chorus(1, 0), { ...chorus(1, 1), detached: true }];
      expect(sharedAnchorAt(lines, sharing, { lineIndex: 2, wordIndex: 0 })?.resumeLineIndex).toBe(3);
    });

    it("skips blank lines inside the instance when finding its first line", () => {
      const lines = [chorus(0, 0, 10), { ...chorus(1, 0), text: "" }, chorus(1, 1)];
      expect(sharedAnchorAt(lines, sharing, { lineIndex: 2, wordIndex: 0 })?.instanceIdx).toBe(1);
    });
  });
});
