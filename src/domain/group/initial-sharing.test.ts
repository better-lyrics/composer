import { initialGroupSharing } from "@/domain/group/initial-sharing";
import type { LyricLine } from "@/domain/line/model";
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

const newGroup = createGroup({ id: "g1", label: "Chorus" });
const share = (lines: LyricLine[], settingOn = true) => initialGroupSharing(lines, newGroup, settingOn);
const sharingOf = (lines: LyricLine[]) => {
  const { sharesTiming, ownTimingInstances } = share(lines).group;
  return { sharesTiming, ownTimingInstances };
};
const secondWordBegin = (lines: readonly LyricLine[], id: string) =>
  lines.find((line) => line.id === id)?.words?.[1]?.begin;

describe("initialGroupSharing", () => {
  it("leaves the group and the lines alone when the setting is off", () => {
    const lines = [shifted(0, 10), shifted(1, 40, 0.2)];
    const result = share(lines, false);
    expect(result.group).toBe(newGroup);
    expect(result.lines).toBe(lines);
  });

  it("shares every instance with the same relative timing and writes no timing", () => {
    const lines = [chorus(0, 0, 10), chorus(1, 0, 40)];
    const result = share(lines);
    expect(sharingOf(lines)).toEqual({ sharesTiming: true, ownTimingInstances: undefined });
    expect(result.lines).toBe(lines);
  });

  it("shares instances with no timing and leaves them unplaced", () => {
    const lines = [chorus(0, 0, 10), chorus(1, 0)];
    const result = share(lines);
    expect(sharingOf(lines)).toEqual({ sharesTiming: true, ownTimingInstances: undefined });
    expect(result.lines.find((line) => line.id === "c1-0")?.words).toBeUndefined();
  });

  it("shares an instance with different timing and realigns it from the source at its start", () => {
    const lines = [shifted(0, 10), shifted(1, 40, 0.2), shifted(2, 70)];
    const result = share(lines);
    expect(sharingOf(lines)).toEqual({ sharesTiming: true, ownTimingInstances: undefined });
    expect(secondWordBegin(result.lines, "c1-0")).toBeCloseTo(40.5, 6);
    expect(result.lines[2]).toBe(lines[2]);
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
    const result = share([partial, shifted(1, 40, 0.2), shifted(2, 70, 0.2)]);
    expect(result.group.ownTimingInstances).toBeUndefined();
    expect(secondWordBegin(result.lines, "c0-0")).toBeCloseTo(1.7, 6);
  });

  describe("regressions", () => {
    it("regression: shares a partly synced instance mid-sync, so sync skips it", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 13), chorus(1, 0, 40), chorus(1, 1)];
      const result = share(lines);
      expect(result.group.ownTimingInstances).toBeUndefined();
      expect(result.lines.find((line) => line.id === "c1-1")?.words?.[0]?.begin).toBeCloseTo(43, 6);
      expect(skippedSharedInstances(result.lines, [result.group]).map((skipped) => skipped.instanceIdx)).toEqual([1]);
    });

    it("regression: shares a partly line-synced instance mid-sync, so sync skips it", () => {
      const lineSynced = (instanceIdx: number, templateLineIdx: number, begin?: number) =>
        createLine({
          id: `l${instanceIdx}-${templateLineIdx}`,
          text: "I want",
          groupId: "g1",
          instanceIdx,
          templateLineIdx,
          ...(begin === undefined ? {} : { begin, end: begin + 2 }),
        });
      const result = share([lineSynced(0, 0, 10), lineSynced(0, 1, 13), lineSynced(1, 0, 40), lineSynced(1, 1)]);
      expect(result.group.ownTimingInstances).toBeUndefined();
      expect(result.lines.find((line) => line.id === "l1-1")).toMatchObject({ begin: 43, end: 45 });
      expect(skippedSharedInstances(result.lines, [result.group]).map((skipped) => skipped.instanceIdx)).toEqual([1]);
    });

    it("regression: measures the offset only over template lines timed in both instances", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 13), chorus(1, 0), chorus(1, 1, 50)];
      const result = share(lines);
      expect(result.group.ownTimingInstances).toBeUndefined();
      expect(result.lines.find((line) => line.id === "c1-0")?.words?.[0]?.begin).toBeCloseTo(47, 6);
    });
  });

  describe("edge cases", () => {
    it("keeps its own timing for an instance the shared timing would put before the song starts", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 13), chorus(1, 0), chorus(1, 1, 1)];
      const result = share(lines);
      expect(result.group).toMatchObject({ sharesTiming: true, ownTimingInstances: [1] });
      expect(result.lines).toEqual(lines);
    });

    it("realigns the instances that fit and keeps only the one that does not", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 13), chorus(1, 0), chorus(1, 1, 1), chorus(2, 0, 70), chorus(2, 1)];
      const result = share(lines);
      expect(result.group.ownTimingInstances).toEqual([1]);
      expect(result.lines.find((line) => line.id === "c2-1")?.words?.[0]?.begin).toBeCloseTo(73, 6);
    });

    it("matches within the 10 ms tolerance without writing timing", () => {
      const lines = [shifted(0, 10), shifted(1, 40, 0.009)];
      expect(share(lines).lines).toBe(lines);
    });

    it("realigns just past the 10 ms tolerance", () => {
      const result = share([shifted(0, 10), shifted(1, 40, 0.011)]);
      expect(result.group.ownTimingInstances).toBeUndefined();
      expect(secondWordBegin(result.lines, "c1-0")).toBeCloseTo(40.5, 6);
    });

    it("regression: keeps its own timing for a half-synced instance that differs when none is fully timed", () => {
      const half = (instanceIdx: number, begin: number) =>
        createLine({
          id: `h${instanceIdx}`,
          text: "I want you",
          words: [
            { text: "I ", begin, end: begin + 0.4 },
            { text: "want ", begin: begin + (instanceIdx === 0 ? 0.5 : 0.8), end: begin + 1.2 },
          ],
          groupId: "g1",
          instanceIdx,
          templateLineIdx: 0,
        });
      const lines = [half(0, 10), half(1, 40)];
      const result = share(lines);
      expect(result.group).toMatchObject({ sharesTiming: true, ownTimingInstances: [1] });
      expect(result.lines).toEqual(lines);
    });

    it("shares half-synced instances that match when none is fully timed", () => {
      const lines = [chorus(0, 0, 10), { ...chorus(1, 0, 40), text: "I want you", id: "x" }];
      expect(sharingOf([{ ...lines[0], text: "I want you" }, lines[1]])).toEqual({
        sharesTiming: true,
        ownTimingInstances: undefined,
      });
    });

    it("shares every instance when none is timed", () => {
      const lines = [chorus(0, 0), chorus(1, 0)];
      expect(share(lines).lines).toBe(lines);
      expect(sharingOf(lines)).toEqual({ sharesTiming: true, ownTimingInstances: undefined });
    });

    it("realigns a line-synced instance to the word timing of the source", () => {
      const lineSynced = createLine({
        id: "c1-0",
        text: "I want",
        begin: 40,
        end: 41,
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
      });
      const result = share([chorus(0, 0, 10), lineSynced]);
      expect(result.group.ownTimingInstances).toBeUndefined();
      expect(secondWordBegin(result.lines, "c1-0")).toBeCloseTo(40.5, 6);
    });

    it("ignores detached lines", () => {
      const lines = [
        chorus(0, 0, 10),
        chorus(1, 0, 40),
        { ...shifted(1, 40, 0.3), id: "d", templateLineIdx: 1, detached: true },
      ];
      expect(share(lines).lines).toBe(lines);
    });

    it("replaces sharing fields the group already had", () => {
      const lines = [shifted(0, 10), shifted(1, 40, 0.2)];
      const old = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] });
      expect(initialGroupSharing(lines, old, true).group.ownTimingInstances).toBeUndefined();
    });
  });

  describe("invariants", () => {
    it("never mutates its input", () => {
      const lines = [shifted(0, 10), shifted(1, 40, 0.2)];
      const snapshot = structuredClone(lines);
      share(lines);
      expect(lines).toEqual(snapshot);
    });

    it("leaves lines outside the group untouched", () => {
      const verse = createLine({ id: "v", text: "Walking home", words: [{ text: "Walking home", begin: 5, end: 6 }] });
      const lines = [verse, shifted(0, 10), shifted(1, 40, 0.2)];
      expect(share(lines).lines[0]).toBe(verse);
    });

    it("keeps the group fields other than sharing", () => {
      const { group } = share([shifted(0, 10), shifted(1, 40, 0.2)]);
      expect(group).toMatchObject({ id: "g1", label: "Chorus", color: newGroup.color });
    });
  });
});
