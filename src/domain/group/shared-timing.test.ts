import { describe, expect, it } from "vitest";
import {
  firstFullyTimedInstance,
  instancesInLineOrder,
  isSharedLine,
  keepsOwnTiming,
  sharedInstancesInLineOrder,
  sharesTiming,
  timeRangeResolver,
  wholeSongRange,
} from "insync/group-shared-timing";
import { chorus } from "@/test/chorus-lines";
import { createGroup, createLine } from "@/test/factories";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

describe("keepsOwnTiming", () => {
  it("is true only for an own-timing instance of a sharing group", () => {
    const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] });
    expect(keepsOwnTiming(group, 1)).toBe(true);
    expect(keepsOwnTiming(group, 0)).toBe(false);
  });

  describe("edge cases", () => {
    it("is false for every instance of an old group", () => {
      expect(keepsOwnTiming(createGroup({ id: "g1", ownTimingInstances: [1] }), 1)).toBe(false);
    });
  });
});

describe("sharesTiming", () => {
  it("is false for an old group", () => {
    expect(sharesTiming(createGroup({ id: "g1" }), 0)).toBe(false);
  });

  it("is true for an instance of a sharing group", () => {
    expect(sharesTiming(createGroup({ id: "g1", sharesTiming: true }), 0)).toBe(true);
  });

  it("is false for an instance with the own timing override", () => {
    const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] });
    expect(sharesTiming(group, 1)).toBe(false);
    expect(sharesTiming(group, 0)).toBe(true);
  });

  describe("edge cases", () => {
    it("is false without a group or an instance index", () => {
      expect(sharesTiming(undefined, 0)).toBe(false);
      expect(sharesTiming(createGroup({ id: "g1", sharesTiming: true }), undefined)).toBe(false);
    });
  });
});

describe("isSharedLine", () => {
  const groups = new Map([["g1", createGroup({ id: "g1", sharesTiming: true })]]);

  it("is true for a linked line of a sharing group", () => {
    expect(isSharedLine(chorus(0, 0, 1), groups)).toBe(true);
  });

  describe("edge cases", () => {
    it("is false for a detached line", () => {
      expect(isSharedLine({ ...chorus(0, 0, 1), detached: true }, groups)).toBe(false);
    });

    it("is false for a line outside any group", () => {
      expect(isSharedLine(createLine({ id: "x" }), groups)).toBe(false);
    });

    it("is false for a line whose group is missing", () => {
      expect(isSharedLine({ ...chorus(0, 0, 1), groupId: "gone" }, groups)).toBe(false);
    });
  });
});

describe("instancesInLineOrder", () => {
  it("orders every attached instance by its first line, whether or not it shares timing", () => {
    const lines = [chorus(2, 0, 1), chorus(0, 0, 10), chorus(1, 0, 20)];
    expect(instancesInLineOrder(lines, "g1")).toEqual([2, 0, 1]);
  });

  describe("edge cases", () => {
    it("leaves out an instance whose lines are all detached", () => {
      const lines = [chorus(0, 0, 1), { ...chorus(1, 0, 10), detached: true }];
      expect(instancesInLineOrder(lines, "g1")).toEqual([0]);
    });

    it("is empty for a group with no lines", () => {
      expect(instancesInLineOrder([chorus(0, 0, 1)], "other")).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("lists the shared instances in the same order", () => {
      const lines = [chorus(2, 0, 1), chorus(0, 0, 10), chorus(1, 0, 20)];
      const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [0] });
      expect(sharedInstancesInLineOrder(lines, group)).toEqual(
        instancesInLineOrder(lines, "g1").filter((instanceIdx) => sharesTiming(group, instanceIdx)),
      );
    });
  });
});

describe("sharedInstancesInLineOrder", () => {
  it("orders instances by their first line position, not by instanceIdx", () => {
    const lines = [chorus(2, 0, 1), chorus(0, 0, 10), chorus(2, 1, 2)];
    expect(sharedInstancesInLineOrder(lines, createGroup({ id: "g1", sharesTiming: true }))).toEqual([2, 0]);
  });

  describe("edge cases", () => {
    it("leaves out own-timing instances", () => {
      const lines = [chorus(0, 0, 1), chorus(1, 0, 10)];
      const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] });
      expect(sharedInstancesInLineOrder(lines, group)).toEqual([0]);
    });

    it("leaves out an instance whose lines are all detached", () => {
      const lines = [chorus(0, 0, 1), { ...chorus(1, 0, 10), detached: true }];
      expect(sharedInstancesInLineOrder(lines, createGroup({ id: "g1", sharesTiming: true }))).toEqual([0]);
    });

    it("is empty for an old group", () => {
      expect(sharedInstancesInLineOrder([chorus(0, 0, 1)], createGroup({ id: "g1" }))).toEqual([]);
    });
  });
});

describe("timeRangeResolver", () => {
  const sharing = [createGroup({ id: "g1", sharesTiming: true })];

  it("gives a line that is not shared the whole song", () => {
    const outside = createLine({ id: "x", text: "Hey", begin: 1, end: 2 });
    expect(timeRangeResolver([outside, chorus(0, 0, 10)], sharing, 60)(outside)).toEqual({ min: 0, max: 60 });
  });

  it("narrows the end by the room left after the last instance", () => {
    const lines = [chorus(0, 0, 10), chorus(1, 0, 58.7)];
    const range = timeRangeResolver(lines, sharing, 60)(lines[0]);
    expect(range.min).toBe(0);
    expect(range.max).toBeCloseTo(60 - (58.7 - 10), 6);
  });

  it("narrows the start by the room left before the first instance", () => {
    const lines = [chorus(0, 0, 0.2), chorus(1, 0, 10)];
    const range = timeRangeResolver(lines, sharing, 60)(lines[1]);
    expect(range.min).toBeCloseTo(10 - 0.2, 6);
    expect(range.max).toBe(60);
  });

  it("regression: measures room from lines both instances have", () => {
    const lines = [chorus(0, 0, 10), chorus(0, 1, 14), chorus(1, 1, 54)];
    const range = timeRangeResolver(lines, sharing, 60)(lines[1]);
    expect(range.max).toBeCloseTo(60 - 40, 6);
  });

  describe("edge cases", () => {
    it("keeps an infinite end infinite", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0, 40)];
      expect(timeRangeResolver(lines, sharing, Number.POSITIVE_INFINITY)(lines[0]).max).toBe(Number.POSITIVE_INFINITY);
    });

    it("ignores own-timing and unplaced siblings", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      const lines = [chorus(0, 0, 10), chorus(1, 0, 59), chorus(2, 0)];
      expect(timeRangeResolver(lines, groups, 60)(lines[0])).toEqual({ min: 0, max: 60 });
    });

    it("gives an unplaced shared line the whole song", () => {
      const lines = [chorus(0, 0), chorus(1, 0, 59)];
      expect(timeRangeResolver(lines, sharing, 60)(lines[0])).toEqual({ min: 0, max: 60 });
    });

    it("regression: treats an unknown duration as no song end, for shared and other lines", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0, 40)];
      for (const duration of [0, Number.NaN]) {
        const range = timeRangeResolver(lines, sharing, duration)(lines[0]);
        expect(range).toEqual({ min: 0, max: Number.POSITIVE_INFINITY });
        expect(range.max).toBeGreaterThanOrEqual(range.min);
      }
    });

    it("gives an old group the whole song", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0, 59)];
      expect(timeRangeResolver(lines, [createGroup({ id: "g1" })], 60)(lines[0])).toEqual({ min: 0, max: 60 });
    });
  });

  describe("invariants", () => {
    it("keeps every placed copy inside the song for a time inside the range", () => {
      const lines = [chorus(0, 0, 3), chorus(1, 0, 10), chorus(2, 0, 55)];
      const range = timeRangeResolver(lines, sharing, 60)(lines[1]);
      for (const offset of [3 - 10, 0, 55 - 10]) {
        expect(range.min + offset).toBeGreaterThanOrEqual(-1e-9);
        expect(range.max + offset).toBeLessThanOrEqual(60 + 1e-9);
      }
    });
  });
});

describe("wholeSongRange", () => {
  it("spans the song", () => {
    expect(wholeSongRange(60)).toEqual({ min: 0, max: 60 });
  });

  describe("edge cases", () => {
    it("has no end for an unknown duration", () => {
      expect(wholeSongRange(0)).toEqual({ min: 0, max: Number.POSITIVE_INFINITY });
      expect(wholeSongRange(Number.NaN)).toEqual({ min: 0, max: Number.POSITIVE_INFINITY });
    });
  });
});

describe("firstFullyTimedInstance", () => {
  it("picks the first fully timed instance in the order given", () => {
    const lines = [chorus(0, 0), chorus(1, 0, 10), chorus(2, 0, 20)];
    expect(firstFullyTimedInstance(lines, "g1", [0, 2, 1], DEFAULT_SPLIT_CHARACTER)).toBe(2);
  });

  describe("edge cases", () => {
    it("skips a partly timed instance", () => {
      const lines = [chorus(0, 0, 1), chorus(0, 1), chorus(1, 0, 10), chorus(1, 1, 12)];
      expect(firstFullyTimedInstance(lines, "g1", [0, 1], DEFAULT_SPLIT_CHARACTER)).toBe(1);
    });

    it("prefers a fully timed instance synced word by word over an earlier line-synced one", () => {
      const lineSynced = (instanceIdx: number, begin: number) =>
        createLine({
          id: `l${instanceIdx}`,
          text: "I want",
          begin,
          end: begin + 1,
          groupId: "g1",
          instanceIdx,
          templateLineIdx: 0,
        });
      expect(firstFullyTimedInstance([lineSynced(0, 1), chorus(1, 0, 10)], "g1", [0, 1], DEFAULT_SPLIT_CHARACTER)).toBe(
        1,
      );
    });

    it("falls back to the first line-synced instance when none is synced word by word", () => {
      const lineSynced = (instanceIdx: number, begin: number) =>
        createLine({
          id: `l${instanceIdx}`,
          text: "I want",
          begin,
          end: begin + 1,
          groupId: "g1",
          instanceIdx,
          templateLineIdx: 0,
        });
      expect(
        firstFullyTimedInstance([lineSynced(0, 1), lineSynced(1, 10)], "g1", [1, 0], DEFAULT_SPLIT_CHARACTER),
      ).toBe(1);
    });

    it("is undefined when no candidate is fully timed or there are no candidates", () => {
      expect(firstFullyTimedInstance([chorus(0, 0)], "g1", [0], DEFAULT_SPLIT_CHARACTER)).toBeUndefined();
      expect(firstFullyTimedInstance([chorus(0, 0, 1)], "g1", [], DEFAULT_SPLIT_CHARACTER)).toBeUndefined();
    });
  });
});
