import { skippedSharedInstances } from "@/domain/sync/skipped-instances";
import { createGroup, createLine } from "@/test/factories";
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
const song = (secondBegin?: number, thirdBegin?: number) => [
  chorus(0, 0, 10),
  chorus(0, 1, 11),
  verse("v1"),
  chorus(1, 0, secondBegin),
  chorus(1, 1, secondBegin === undefined ? undefined : secondBegin + 1),
  verse("v2"),
  chorus(2, 0, thirdBegin),
  chorus(2, 1, thirdBegin === undefined ? undefined : thirdBegin + 1),
];

describe("skippedSharedInstances", () => {
  it("lists a placed later instance with its lines", () => {
    expect(skippedSharedInstances(song(40), sharing)).toEqual([
      {
        groupId: "g1",
        instanceIdx: 1,
        lineIds: ["c1-0", "c1-1"],
        syncableLineCount: 2,
        firstLineIndex: 3,
        lastLineIndex: 4,
      },
    ]);
  });

  it("lists every placed later instance in line order", () => {
    expect(skippedSharedInstances(song(40, 70), sharing).map((skipped) => skipped.instanceIdx)).toEqual([1, 2]);
  });

  it("never lists the first instance, which is synced word by word", () => {
    expect(skippedSharedInstances(song(40), sharing).some((skipped) => skipped.instanceIdx === 0)).toBe(false);
  });

  describe("edge cases", () => {
    it("is empty when no later instance is placed", () => {
      expect(skippedSharedInstances(song(), sharing)).toEqual([]);
    });

    it("is empty for an old group", () => {
      expect(skippedSharedInstances(song(40), [createGroup({ id: "g1" })])).toEqual([]);
    });

    it("leaves out an own-timing instance", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      expect(skippedSharedInstances(song(40), groups)).toEqual([]);
    });

    it("leaves out a placed instance when no other instance is fully timed", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1), chorus(1, 0, 40), chorus(1, 1)];
      expect(skippedSharedInstances(lines, sharing)).toEqual([]);
    });

    it("leaves out a detached line and counts only syncable lines", () => {
      const lines = [
        ...song(40).slice(0, 3),
        chorus(1, 0, 40),
        { ...chorus(1, 1, 41), text: "" },
        { ...chorus(1, 2), detached: true },
      ];
      const [skipped] = skippedSharedInstances(lines, sharing);
      expect(skipped).toMatchObject({ lineIds: ["c1-0", "c1-1"], syncableLineCount: 1, lastLineIndex: 4 });
    });

    it("is empty for a song with no lines", () => {
      expect(skippedSharedInstances([], sharing)).toEqual([]);
    });
  });
});
