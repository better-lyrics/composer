import {
  isSharedLine,
  placeSharedInstance,
  sharedInstancesInLineOrder,
  sharedTimingFanOut,
  sharesTiming,
  timeRangeResolver,
} from "@/domain/group/shared-timing";
import { instanceBounds } from "@/domain/instance/bounds";
import { type LineUpdate, type LyricLine, reconcileLine } from "@/domain/line/model";
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

describe("placeSharedInstance", () => {
  const sharing = [createGroup({ id: "g1", sharesTiming: true })];
  const wordTimes = (line: LyricLine | Partial<LyricLine> | undefined) =>
    line?.words?.map((word) => [word.begin, word.end]);
  const expectTimes = (actual: number[][] | undefined, expected: number[][]) => {
    expect(actual).toHaveLength(expected.length);
    expected.forEach(([begin, end], i) => {
      expect(actual?.[i]?.[0]).toBeCloseTo(begin, 6);
      expect(actual?.[i]?.[1]).toBeCloseTo(end, 6);
    });
  };

  it("fills an instance with no timing from the reference instance", () => {
    const updates = placeSharedInstance([chorus(0, 0, 10), chorus(1, 0)], sharing, "g1", 1, 40);
    expect(updates.map((update) => update.id)).toEqual(["c1-0"]);
    expectTimes(wordTimes(updates[0]?.updates), [
      [40, 40.4],
      [40.5, 41],
    ]);
  });

  it("moves an instance that is already timed", () => {
    const filled = placeSharedInstance([chorus(0, 0, 10), chorus(1, 0)], sharing, "g1", 1, 40);
    const moved = placeSharedInstance([chorus(0, 0, 10), chorus(1, 0, 20)], sharing, "g1", 1, 40);
    expect(moved).toEqual(filled);
  });

  it("places line-synced lines and background words", () => {
    const lines = [
      chorus(0, 0, 10),
      createLine({
        id: "c0-1",
        text: "Oh",
        begin: 12,
        end: 14,
        backgroundText: "ah",
        backgroundWords: [{ text: "ah", begin: 12.5, end: 13 }],
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 1,
      }),
      chorus(1, 0),
      createLine({ id: "c1-1", text: "Oh", backgroundText: "ah", groupId: "g1", instanceIdx: 1, templateLineIdx: 1 }),
    ];
    const updates = placeSharedInstance(lines, sharing, "g1", 1, 40);
    const lineSynced = updates.find((update) => update.id === "c1-1")?.updates;
    expect(lineSynced?.begin).toBeCloseTo(42, 6);
    expect(lineSynced?.end).toBeCloseTo(44, 6);
    expect(lineSynced?.words).toBeUndefined();
    expectTimes(
      lineSynced?.backgroundWords?.map((word) => [word.begin, word.end]),
      [[42.5, 43]],
    );
  });

  it("anchors at the instance start, not at the first line's start", () => {
    const lines = [chorus(0, 0, 11), chorus(0, 1, 10), chorus(1, 0), chorus(1, 1)];
    const updates = placeSharedInstance(lines, sharing, "g1", 1, 40);
    expectTimes(wordTimes(updates.find((update) => update.id === "c1-0")?.updates), [
      [41, 41.4],
      [41.5, 42],
    ]);
    expectTimes(wordTimes(updates.find((update) => update.id === "c1-1")?.updates), [
      [40, 40.4],
      [40.5, 41],
    ]);
  });

  describe("edge cases", () => {
    it("returns nothing when no other shared instance is fully timed", () => {
      const partial = createLine({
        id: "c0-0",
        text: "I want",
        words: [{ text: "I ", begin: 10, end: 10.4 }],
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
      });
      expect(placeSharedInstance([partial, chorus(1, 0)], sharing, "g1", 1, 40)).toEqual([]);
    });

    it("returns nothing for an own-timing target", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      expect(placeSharedInstance([chorus(0, 0, 10), chorus(1, 0)], groups, "g1", 1, 40)).toEqual([]);
    });

    it("returns nothing for an old group or a missing group", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0)];
      expect(placeSharedInstance(lines, [createGroup({ id: "g1" })], "g1", 1, 40)).toEqual([]);
      expect(placeSharedInstance(lines, sharing, "missing", 1, 40)).toEqual([]);
    });

    it("skips detached lines of the target", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 11), chorus(1, 0), { ...chorus(1, 1), detached: true }];
      expect(placeSharedInstance(lines, sharing, "g1", 1, 40).map((update) => update.id)).toEqual(["c1-0"]);
    });

    it("never uses an own-timing instance as the reference", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [0] })];
      const lines = [chorus(0, 0, 10), chorus(1, 0), chorus(2, 0)];
      expect(placeSharedInstance(lines, groups, "g1", 2, 40)).toEqual([]);
    });

    it("uses the first fully timed shared instance in line order", () => {
      const reference = createLine({
        id: "c3-0",
        text: "I want",
        words: [
          { text: "I ", begin: 5, end: 5.2 },
          { text: "want", begin: 5.3, end: 6 },
        ],
        groupId: "g1",
        instanceIdx: 3,
        templateLineIdx: 0,
      });
      const updates = placeSharedInstance([reference, chorus(0, 0, 10), chorus(1, 0)], sharing, "g1", 1, 40);
      expectTimes(wordTimes(updates[0]?.updates), [
        [40, 40.2],
        [40.3, 41],
      ]);
    });
  });

  describe("invariants", () => {
    it("does not mutate its input", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0, 20)];
      const snapshot = structuredClone(lines);
      placeSharedInstance(lines, sharing, "g1", 1, 40);
      expect(lines).toEqual(snapshot);
    });

    it("gives equal updates when placed twice at the same start", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0)];
      expect(placeSharedInstance(lines, sharing, "g1", 1, 40)).toEqual(
        placeSharedInstance(lines, sharing, "g1", 1, 40),
      );
    });

    it("keeps word text and syllable structure from the reference", () => {
      const reference = createLine({
        id: "c0-0",
        text: "a|way",
        words: [
          { text: "a", begin: 10, end: 10.2, syllableGroupId: "s1" },
          { text: "way", begin: 10.2, end: 10.6, syllableGroupId: "s1" },
        ],
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
      });
      const target = createLine({ id: "c1-0", text: "a|way", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 });
      const words = placeSharedInstance([reference, target], sharing, "g1", 1, 40)[0]?.updates.words;
      expect(words?.map((word) => [word.text, word.syllableGroupId])).toEqual([
        ["a", "s1"],
        ["way", "s1"],
      ]);
    });
  });
});

describe("sharedTimingFanOut", () => {
  const sharing = [createGroup({ id: "g1", sharesTiming: true })];

  function edit(lines: LyricLine[], id: string, change: (line: LyricLine) => LineUpdate["updates"]): LyricLine[] {
    return lines.map((line) => (line.id === id ? reconcileLine({ ...line, ...change(line) }) : line));
  }

  function nudgeWord(wordIdx: number, delta: number) {
    return (line: LyricLine): LineUpdate["updates"] => ({
      words: line.words?.map((word, i) =>
        i === wordIdx ? { ...word, begin: word.begin + delta, end: word.end + delta } : word,
      ),
    });
  }

  function relativeTiming(lines: readonly LyricLine[], groupId: string, instanceIdx: number) {
    const members = lines.filter((line) => line.groupId === groupId && line.instanceIdx === instanceIdx);
    const start = instanceBounds(members)?.begin ?? 0;
    const round = (time: number) => Math.round((time - start) * 1e6) / 1e6;
    return members.map((line) => ({
      templateLineIdx: line.templateLineIdx,
      words: line.words?.map((word) => [round(word.begin), round(word.end)]),
      backgroundWords: line.backgroundWords?.map((word) => [round(word.begin), round(word.end)]),
      begin: line.begin === undefined ? undefined : round(line.begin),
      end: line.end === undefined ? undefined : round(line.end),
    }));
  }

  const byId = (lines: readonly LyricLine[], id: string) => lines.find((line) => line.id === id);
  const times = (line: LyricLine | undefined) => line?.words?.map((word) => [word.begin, word.end]);
  const expectTimes = (actual: number[][] | undefined, expected: number[][]) => {
    expect(actual).toHaveLength(expected.length);
    expected.forEach(([begin, end], i) => {
      expect(actual?.[i]?.[0]).toBeCloseTo(begin, 6);
      expect(actual?.[i]?.[1]).toBeCloseTo(end, 6);
    });
  };

  it("copies a nudge to every placed shared instance", () => {
    const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
    const after = edit(before, "c0-0", nudgeWord(1, 0.15));
    const result = sharedTimingFanOut(before, after, sharing, ["c0-0"]);
    expect(result.rejected).toBe(false);
    expect(result.touchedGroupIds).toEqual(["g1"]);
    expectTimes(times(byId(result.lines, "c1-0")), [
      [40, 40.4],
      [40.65, 41.15],
    ]);
  });

  it("copies background words and line-synced lines", () => {
    const lineSynced = (instanceIdx: number, begin: number) =>
      createLine({
        id: `o${instanceIdx}`,
        text: "Oh",
        begin,
        end: begin + 2,
        backgroundText: "ah",
        backgroundWords: [{ text: "ah", begin: begin + 0.5, end: begin + 1 }],
        groupId: "g1",
        instanceIdx,
        templateLineIdx: 1,
      });
    const before = [chorus(0, 0, 10), lineSynced(0, 11), chorus(1, 0, 40), lineSynced(1, 41)];
    const after = edit(before, "o0", (line) => ({
      begin: 11.2,
      end: 13.5,
      backgroundWords: line.backgroundWords?.map((word) => ({ ...word, begin: 12, end: 12.6 })),
    }));
    const copied = byId(sharedTimingFanOut(before, after, sharing, ["o0"]).lines, "o1");
    expect(copied?.begin).toBeCloseTo(41.2, 6);
    expect(copied?.end).toBeCloseTo(43.5, 6);
    expectTimes(
      copied?.backgroundWords?.map((word) => [word.begin, word.end]),
      [[42, 42.6]],
    );
  });

  it("copies only timing fields", () => {
    const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
    const after = edit(before, "c0-0", (line) => ({ ...nudgeWord(1, 0.1)(line), agentId: "v2" }));
    const copied = byId(sharedTimingFanOut(before, after, sharing, ["c0-0"]).lines, "c1-0");
    expect(copied?.agentId).toBe(before[1].agentId);
    expect(copied?.text).toBe("I want");
  });

  describe("edge cases", () => {
    it("never copies a line outside the group", () => {
      const outside = createLine({ id: "x", text: "Hey", words: [{ text: "Hey", begin: 5, end: 6 }] });
      const before = [outside, chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(before, "x", () => ({ words: [{ text: "Hey", begin: 5, end: 6.5 }] }));
      const result = sharedTimingFanOut(before, after, sharing, ["x"]);
      expect(result.lines).toBe(after);
      expect(result.touchedGroupIds).toEqual([]);
    });

    it("leaves old groups untouched", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(before, "c0-0", nudgeWord(1, 0.1));
      expect(sharedTimingFanOut(before, after, [createGroup({ id: "g1" })], ["c0-0"]).lines).toBe(after);
    });

    it("leaves own-timing, detached and unplaced targets untouched", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      const before = [chorus(0, 0, 10), chorus(1, 0, 40), { ...chorus(2, 0, 60), detached: true }, chorus(3, 0)];
      const after = edit(before, "c0-0", nudgeWord(1, 0.1));
      expect(sharedTimingFanOut(before, after, groups, ["c0-0"]).lines).toBe(after);
    });

    it("skips a source whose instance had no start before the edit", () => {
      const before = [chorus(0, 0), chorus(1, 0, 40)];
      const after = edit(before, "c0-0", () => ({ words: [{ text: "I ", begin: 10, end: 10.4 }] }));
      expect(sharedTimingFanOut(before, after, sharing, ["c0-0"]).lines).toBe(after);
    });

    it("copies a clear to placed targets", () => {
      const before = [chorus(0, 0, 10), chorus(0, 1, 12), chorus(1, 0, 40), chorus(1, 1, 42)];
      const after = edit(before, "c0-1", () => ({ words: undefined }));
      const copied = byId(sharedTimingFanOut(before, after, sharing, ["c0-1"]).lines, "c1-1");
      expect(copied?.words).toBeUndefined();
      expect(copied?.begin).toBeUndefined();
    });

    it("returns the same array when timing did not change", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(before, "c0-0", () => ({ agentId: "v2" }));
      expect(sharedTimingFanOut(before, after, sharing, ["c0-0"]).lines).toBe(after);
    });
  });

  describe("regressions", () => {
    it("regression: offsets come from instance starts before the edit", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(before, "c0-0", nudgeWord(0, 0.05));
      expectTimes(times(byId(sharedTimingFanOut(before, after, sharing, ["c0-0"]).lines, "c1-0")), [
        [40.05, 40.45],
        [40.5, 41],
      ]);
    });

    it("regression: a batch that nudges two instances moves each by the delta once", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 40)];
      const after = edit(edit(before, "c0-0", nudgeWord(1, 0.1)), "c1-0", nudgeWord(1, 0.1));
      const lines = sharedTimingFanOut(before, after, sharing, ["c0-0", "c1-0"]).lines;
      expectTimes(times(byId(lines, "c0-0")), [
        [10, 10.4],
        [10.6, 11.1],
      ]);
      expectTimes(times(byId(lines, "c1-0")), [
        [40, 40.4],
        [40.6, 41.1],
      ]);
    });

    it("regression: the first changed instance in line order wins", () => {
      const before = [chorus(1, 0, 10), chorus(0, 0, 40)];
      const after = edit(edit(before, "c1-0", nudgeWord(1, 0.1)), "c0-0", nudgeWord(1, 0.3));
      const lines = sharedTimingFanOut(before, after, sharing, ["c0-0", "c1-0"]).lines;
      expectTimes(times(byId(lines, "c0-0")), [
        [40, 40.4],
        [40.6, 41.1],
      ]);
    });
  });

  describe("song start guard", () => {
    it("rejects a batch that would move a copy below zero", () => {
      const before = [chorus(0, 0, 10), chorus(1, 0, 0.05)];
      const after = edit(before, "c0-0", nudgeWord(0, -0.2));
      const result = sharedTimingFanOut(before, after, sharing, ["c0-0"]);
      expect(result.rejected).toBe(true);
      expect(result.lines).toBe(after);
      expect(result.touchedGroupIds).toEqual([]);
    });
  });

  describe("invariants", () => {
    const before = [
      chorus(0, 0, 10),
      chorus(0, 1, 11.5),
      createLine({ id: "gap", text: "Between" }),
      chorus(1, 0, 40),
      chorus(1, 1, 41.5),
      chorus(2, 0, 70),
      chorus(2, 1, 71.5),
    ];
    const after = edit(edit(before, "c1-1", nudgeWord(1, 0.2)), "c1-0", nudgeWord(0, -0.1));

    it("keeps every placed shared instance at the same relative timing", () => {
      const lines = sharedTimingFanOut(before, after, sharing, ["c1-1", "c1-0"]).lines;
      expect(relativeTiming(lines, "g1", 0)).toEqual(relativeTiming(lines, "g1", 1));
      expect(relativeTiming(lines, "g1", 2)).toEqual(relativeTiming(lines, "g1", 1));
    });

    it("does not mutate its inputs", () => {
      const beforeSnapshot = structuredClone(before);
      const afterSnapshot = structuredClone(after);
      sharedTimingFanOut(before, after, sharing, ["c1-1", "c1-0"]);
      expect(before).toEqual(beforeSnapshot);
      expect(after).toEqual(afterSnapshot);
    });

    it("changes nothing when run again on its own output", () => {
      const once = sharedTimingFanOut(before, after, sharing, ["c1-1", "c1-0"]).lines;
      const twice = sharedTimingFanOut(before, once, sharing, ["c1-1", "c1-0"]).lines;
      expect(twice).toEqual(once);
    });

    it("keeps lines outside the group by reference", () => {
      const lines = sharedTimingFanOut(before, after, sharing, ["c1-1", "c1-0"]).lines;
      expect(byId(lines, "gap")).toBe(byId(after, "gap"));
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
