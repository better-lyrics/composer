import { placeSharedInstance, realignSharedInstance, realignSharedInstances } from "@/domain/group/shared-placement";
import type { LyricLine } from "@/domain/line/model";
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

  it("puts the first line's main vocal at the anchor time, even when a later line starts earlier", () => {
    const lines = [chorus(0, 0, 11), chorus(0, 1, 10), chorus(1, 0), chorus(1, 1)];
    const updates = placeSharedInstance(lines, sharing, "g1", 1, 40);
    expectTimes(wordTimes(updates.find((update) => update.id === "c1-0")?.updates), [
      [40, 40.4],
      [40.5, 41],
    ]);
    expectTimes(wordTimes(updates.find((update) => update.id === "c1-1")?.updates), [
      [39, 39.4],
      [39.5, 40],
    ]);
  });

  it("regression: puts the tapped main word at the anchor time when background words start first", () => {
    const reference = createLine({
      id: "c0-0",
      text: "I want",
      words: [
        { text: "I ", begin: 10.4, end: 10.8 },
        { text: "want", begin: 10.9, end: 11.4 },
      ],
      backgroundText: "oh",
      backgroundWords: [{ text: "oh", begin: 10, end: 10.3 }],
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
    });
    const target = createLine({
      id: "c1-0",
      text: "I want",
      backgroundText: "oh",
      groupId: "g1",
      instanceIdx: 1,
      templateLineIdx: 0,
    });
    const updates = placeSharedInstance([reference, target], sharing, "g1", 1, 100)[0]?.updates;
    expect(updates?.words?.[0]?.begin).toBeCloseTo(100, 6);
    expect(updates?.backgroundWords?.[0]?.begin).toBeCloseTo(99.6, 6);
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

describe("realignSharedInstance", () => {
  const sharing = [createGroup({ id: "g1", sharesTiming: true })];
  const updatesOf = (realignment: ReturnType<typeof realignSharedInstance>) =>
    "updates" in realignment ? realignment.updates : [];

  it("gives an instance the shared timing where it already sits", () => {
    const moved = createLine({
      id: "c1-0",
      text: "I want",
      words: [
        { text: "I ", begin: 40, end: 40.4 },
        { text: "want", begin: 40.8, end: 41.3 },
      ],
      groupId: "g1",
      instanceIdx: 1,
      templateLineIdx: 0,
    });
    const words = updatesOf(realignSharedInstance([chorus(0, 0, 10), moved], sharing, "g1", 1))[0]?.updates.words;
    expect(words?.map((word) => word.begin)).toEqual([40, 40.5]);
  });

  describe("edge cases", () => {
    it("leaves an instance with no timing alone", () => {
      expect(realignSharedInstance([chorus(0, 0, 10), chorus(1, 0)], sharing, "g1", 1)).toEqual({ updates: [] });
    });

    it("refuses a timed instance when no other instance is fully timed", () => {
      expect(realignSharedInstance([chorus(0, 0), chorus(1, 0, 40)], sharing, "g1", 1)).toEqual({
        refusal: "no-fully-synced-instance",
      });
    });

    it("refuses a timed instance whose shared copy would start before zero", () => {
      const lines = [chorus(0, 0, 30), chorus(0, 1, 10), chorus(1, 0, 5), chorus(1, 1)];
      expect(realignSharedInstance(lines, sharing, "g1", 1)).toEqual({ refusal: "before-song-start" });
    });

    it("refuses a timed instance whose shared copy would run past the song end", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 60), chorus(1, 0, 280), chorus(1, 1)];
      expect(realignSharedInstance(lines, sharing, "g1", 1, 300)).toEqual({ refusal: "past-song-end" });
    });

    it("realigns an instance that ends exactly at the song end", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 60), chorus(1, 0, 249), chorus(1, 1)];
      expect(updatesOf(realignSharedInstance(lines, sharing, "g1", 1, 300))).toHaveLength(2);
    });

    it("realigns without an end limit when no song end is given", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 60), chorus(1, 0, 280), chorus(1, 1)];
      expect(updatesOf(realignSharedInstance(lines, sharing, "g1", 1))).toHaveLength(2);
    });

    it("refuses an instance whose timed background vocals the reference has no timing for", () => {
      const withBackground = createLine({
        ...chorus(1, 0, 40),
        backgroundText: "oh",
        backgroundWords: [{ text: "oh", begin: 40.2, end: 40.6 }],
      });
      const lines = [createLine({ ...chorus(0, 0, 10), backgroundText: "oh" }), withBackground];
      expect(realignSharedInstance(lines, sharing, "g1", 1)).toEqual({ refusal: "would-lose-word-timing" });
    });

    it("refuses a word-synced instance when the reference mixes word and line timing", () => {
      const lineSynced = createLine({ ...chorus(0, 1), begin: 13, end: 14 });
      const lines = [chorus(0, 0, 10), lineSynced, chorus(1, 0, 40), chorus(1, 1, 43.2)];
      expect(realignSharedInstance(lines, sharing, "g1", 1)).toEqual({ refusal: "would-lose-word-timing" });
    });

    it("realigns background vocals the reference has timing for", () => {
      const background = (begin: number) => ({
        backgroundText: "oh",
        backgroundWords: [{ text: "oh", begin, end: begin + 0.4 }],
      });
      const lines = [
        { ...chorus(0, 0, 10), ...background(10.2) },
        { ...chorus(1, 0, 40), ...background(40.5) },
      ];
      expect(
        updatesOf(realignSharedInstance(lines, sharing, "g1", 1))[0]?.updates.backgroundWords?.[0]?.begin,
      ).toBeCloseTo(40.2, 6);
    });

    it("refuses a timed instance with no synced line in common with the reference", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 14), chorus(1, 0), chorus(1, 1), { ...chorus(1, 2, 60), text: "" }];
      expect(realignSharedInstance(lines, sharing, "g1", 1)).toEqual({ refusal: "no-common-timed-line" });
    });

    it("refuses a timed instance of a group that does not share it", () => {
      const own = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      expect(realignSharedInstance([chorus(0, 0, 10), chorus(1, 0, 40)], own, "g1", 1)).toEqual({
        refusal: "no-fully-synced-instance",
      });
    });

    it("anchors on lines both instances have", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 14), chorus(1, 1, 54)];
      const words = updatesOf(realignSharedInstance(lines, sharing, "g1", 1))[0]?.updates.words;
      expect(words?.[0]?.begin).toBeCloseTo(54, 6);
    });
  });
});

describe("realignSharedInstances", () => {
  const sharing = [createGroup({ id: "g1", sharesTiming: true })];
  const firstBegin = (lines: readonly LyricLine[], id: string) =>
    lines.find((line) => line.id === id)?.words?.[0]?.begin;

  it("realigns every listed instance and keeps none on its own timing", () => {
    const lines = [chorus(0, 0, 10), chorus(0, 1, 13), chorus(1, 0, 40), chorus(1, 1), chorus(2, 0, 70), chorus(2, 1)];
    const result = realignSharedInstances(lines, sharing, "g1", [1, 2]);
    expect(result.keptOwnTiming).toEqual([]);
    expect(result.realigned).toEqual([1, 2]);
    expect(firstBegin(result.lines, "c1-1")).toBeCloseTo(43, 6);
    expect(firstBegin(result.lines, "c2-1")).toBeCloseTo(73, 6);
  });

  describe("edge cases", () => {
    it("keeps an instance that cannot be placed and realigns the rest", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 13), chorus(1, 0), chorus(1, 1, 1), chorus(2, 0, 70), chorus(2, 1)];
      const result = realignSharedInstances(lines, sharing, "g1", [1, 2]);
      expect(result.keptOwnTiming).toEqual([{ instanceIdx: 1, refusal: "before-song-start" }]);
      expect(result.lines.slice(0, 4)).toEqual(lines.slice(0, 4));
      expect(firstBegin(result.lines, "c2-1")).toBeCloseTo(73, 6);
    });

    it("keeps an instance that would run past the song end", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 60), chorus(1, 0, 280), chorus(1, 1)];
      const result = realignSharedInstances(lines, sharing, "g1", [1], 300);
      expect(result).toEqual({ lines, keptOwnTiming: [{ instanceIdx: 1, refusal: "past-song-end" }], realigned: [] });
    });

    it("returns the same lines when nothing is listed", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0, 40)];
      expect(realignSharedInstances(lines, sharing, "g1", [])).toEqual({ lines, keptOwnTiming: [], realigned: [] });
    });

    it("leaves an unplaced instance unplaced", () => {
      const lines = [chorus(0, 0, 10), chorus(1, 0)];
      const result = realignSharedInstances(lines, sharing, "g1", [1]);
      expect(result).toEqual({ lines, keptOwnTiming: [], realigned: [] });
    });
  });

  describe("invariants", () => {
    it("never mutates its input", () => {
      const lines = [chorus(0, 0, 10), chorus(0, 1, 13), chorus(1, 0, 40), chorus(1, 1)];
      const snapshot = structuredClone(lines);
      realignSharedInstances(lines, sharing, "g1", [1]);
      expect(lines).toEqual(snapshot);
    });
  });
});

describe("placing near the song start", () => {
  it("places nothing when a line would start before zero", () => {
    const lines = [chorus(0, 0, 11), chorus(0, 1, 10), chorus(1, 0), chorus(1, 1)];
    expect(placeSharedInstance(lines, [createGroup({ id: "g1", sharesTiming: true })], "g1", 1, 0.5)).toEqual([]);
  });
});
