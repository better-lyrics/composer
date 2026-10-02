/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { subscribeSharedTimingCopied } from "@/lib/shared-timing-signals";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { createGroup, createLine } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

const chorus = (instanceIdx: number, begin?: number, secondWordShift = 0) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "I want",
    ...(begin === undefined
      ? {}
      : {
          words: [
            { text: "I ", begin, end: begin + 0.4 },
            { text: "want", begin: begin + 0.5 + secondWordShift, end: begin + 1 + secondWordShift },
          ],
        }),
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
  });

function seed(groups: LinkGroup[], lines: LyricLine[]) {
  useProjectStore.setState({ groups, lines, isDirtySinceHistory: true });
}

const SONG_LENGTH = 300;
const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);
const groupById = (id: string) => store().groups.find((group) => group.id === id);

beforeEach(() => {
  store().reset();
  store().clearHistory();
  useSettingsStore.setState({ shareTimingInNewGroups: true });
});

describe("groupRepeatingSections", () => {
  const plain = (id: string, begin?: number, secondWordShift = 0) => ({
    ...chorus(0, begin, secondWordShift),
    id,
    groupId: undefined,
    instanceIdx: undefined,
    templateLineIdx: undefined,
  });
  const plainLine = (id: string, text: string, begin?: number) =>
    createLine({
      id,
      text,
      ...(begin === undefined ? {} : { words: [{ text, begin, end: begin + 1 }] }),
    });
  const go = (id: string, begin?: number) => plainLine(id, "go", begin);
  const stay = (id: string, begin?: number) => plainLine(id, "stay", begin);

  it("shares timing in a new group when the setting is on", () => {
    seed([], [plain("a", 10), plain("b", 40)]);
    store().groupRepeatingSections([0, 1], 1);
    expect(store().groups[0]).toMatchObject({ sharesTiming: true });
    expect(store().groups[0].ownTimingInstances).toBeUndefined();
  });

  it("shares an instance with different timing and realigns it from the source", () => {
    seed([], [plain("a", 10), plain("b", 40, 0.3)]);
    expect(store().groupRepeatingSections([0, 1], 1)).toEqual({ keptOwnTiming: [], replaced: [1] });
    expect(store().groups[0].ownTimingInstances).toBeUndefined();
    expect(lineById("b")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
  });

  it("regression: shares a partly synced instance mid-sync and fills it from the source", () => {
    seed([], [go("a1", 10), stay("a2", 13), go("b1", 40), stay("b2")]);
    store().groupRepeatingSections([0, 2], 2);
    expect(store().groups[0].ownTimingInstances).toBeUndefined();
    expect(lineById("b2")?.words?.[0]?.begin).toBeCloseTo(43, 6);
  });

  it("groups and realigns as one undo step", () => {
    seed([], [plain("a", 10), plain("b", 40, 0.3)]);
    store().groupRepeatingSections([0, 1], 1);
    expect(lineById("b")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
    store().undo();
    expect(store().groups).toEqual([]);
    expect(lineById("b")?.groupId).toBeUndefined();
    expect(lineById("b")?.words?.[1]?.begin).toBeCloseTo(40.8, 6);
  });

  it("keeps its own timing for an instance the shared timing would put before the song starts", () => {
    seed([], [go("a1", 10), stay("a2", 13), go("b1"), stay("b2", 1)]);
    expect(store().groupRepeatingSections([0, 2], 2).keptOwnTiming).toEqual([
      { instanceIdx: 1, refusal: "before-song-start" },
    ]);
    expect(store().groups[0]).toMatchObject({ sharesTiming: true, ownTimingInstances: [1] });
    expect(lineById("b2")?.words?.[0]?.begin).toBe(1);
    expect(lineById("b1")?.words).toBeUndefined();
  });

  it("keeps its own timing for an instance the shared timing would run past the song end", () => {
    seed([], [go("a1", 10), stay("a2", 60), go("b1", 280), stay("b2")]);
    expect(store().groupRepeatingSections([0, 2], 2, { duration: SONG_LENGTH }).keptOwnTiming).toEqual([
      { instanceIdx: 1, refusal: "past-song-end" },
    ]);
    expect(store().groups[0].ownTimingInstances).toEqual([1]);
    expect(lineById("b2")?.words).toBeUndefined();
  });

  it("creates an old group and writes no timing when the setting is off", () => {
    useSettingsStore.setState({ shareTimingInNewGroups: false });
    seed([], [plain("a", 10), plain("b", 40, 0.3)]);
    store().groupRepeatingSections([0, 1], 1);
    expect(store().groups[0].sharesTiming).toBeUndefined();
    expect(lineById("b")?.words?.[1]?.begin).toBeCloseTo(40.8, 6);
  });

  it("leaves an untimed instance unplaced", () => {
    seed([], [plain("a", 10), plain("b")]);
    store().groupRepeatingSections([0, 1], 1);
    expect(lineById("b")?.words).toBeUndefined();
  });

  describe("invariants", () => {
    it("keeps the text of a partly synced line outside the group", () => {
      const current = createLine({ id: "v", text: "walking home", words: [{ text: "walking ", begin: 50, end: 51 }] });
      seed([], [plain("a", 10), plain("b", 40), current]);
      store().groupRepeatingSections([0, 1], 1);
      expect(lineById("v")?.text).toBe("walking home");
    });
  });
});

describe("setInstanceOwnTiming", () => {
  it("gives an instance its own timing without moving it", () => {
    seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1, 40)]);
    const linesBefore = store().lines;
    store().setInstanceOwnTiming("g1", 1, true, SONG_LENGTH);
    expect(groupById("g1")?.ownTimingInstances).toEqual([1]);
    expect(store().lines).toEqual(linesBefore);
  });

  it("shares an instance again and takes the shared timing at its start", () => {
    seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40, 0.3)]);
    store().setInstanceOwnTiming("g1", 1, false, SONG_LENGTH);
    expect(groupById("g1")?.ownTimingInstances).toBeUndefined();
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
  });

  it("is one undo step", () => {
    seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40, 0.3)]);
    store().setInstanceOwnTiming("g1", 1, false, SONG_LENGTH);
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
    store().undo();
    expect(groupById("g1")?.ownTimingInstances).toEqual([1]);
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.8, 6);
  });

  describe("edge cases", () => {
    it("leaves an unplaced instance unplaced when shared again", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1)]);
      store().setInstanceOwnTiming("g1", 1, false, SONG_LENGTH);
      expect(lineById("c1")?.words).toBeUndefined();
    });

    it("keeps a timed instance on its own timing and reports why when no instance is fully timed", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0), chorus(1, 40)]);
      expect(store().setInstanceOwnTiming("g1", 1, false, SONG_LENGTH)).toBe("no-fully-synced-instance");
      expect(groupById("g1")?.ownTimingInstances).toEqual([1]);
    });

    it("reports no refusal when the instance takes the shared timing", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40)]);
      expect(store().setInstanceOwnTiming("g1", 1, false, SONG_LENGTH)).toBeNull();
    });

    it("refuses to share an instance again when the shared timing would run past the song end", () => {
      seed(
        [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })],
        [chorus(0, 10), chorus(1, 299.5, 0.3)],
      );
      expect(store().setInstanceOwnTiming("g1", 1, false, 300)).toBe("past-song-end");
      expect(groupById("g1")?.ownTimingInstances).toEqual([1]);
    });

    it("does not list an instance twice", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40)]);
      store().setInstanceOwnTiming("g1", 1, true, SONG_LENGTH);
      expect(groupById("g1")?.ownTimingInstances).toEqual([1]);
    });
  });
});

describe("shareGroupTiming", () => {
  it("opts an old group in and realigns an instance with different timing", () => {
    seed([createGroup({ id: "g1" })], [chorus(0, 10), chorus(1, 40, 0.3), chorus(2)]);
    expect(store().shareGroupTiming("g1", SONG_LENGTH)).toEqual({ keptOwnTiming: [], replaced: [1] });
    expect(groupById("g1")).toMatchObject({ sharesTiming: true });
    expect(groupById("g1")?.ownTimingInstances).toBeUndefined();
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
    expect(lineById("c2")?.words).toBeUndefined();
  });

  it("keeps its own timing for an instance that would run past the song end", () => {
    seed([createGroup({ id: "g1" })], [chorus(0, 10), chorus(1, 299.5, 0.3)]);
    expect(store().shareGroupTiming("g1", 300).keptOwnTiming).toEqual([{ instanceIdx: 1, refusal: "past-song-end" }]);
  });

  it("opts in even when the setting is off", () => {
    useSettingsStore.setState({ shareTimingInNewGroups: false });
    seed([createGroup({ id: "g1" })], [chorus(0, 10), chorus(1, 40, 0.3)]);
    store().shareGroupTiming("g1", SONG_LENGTH);
    expect(groupById("g1")?.sharesTiming).toBe(true);
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
  });

  it("shares every own-timing instance of a sharing group", () => {
    seed(
      [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1, 2] })],
      [chorus(0, 10), chorus(1, 40, 0.3), chorus(2, 70, -0.2)],
    );
    store().shareGroupTiming("g1", SONG_LENGTH);
    expect(groupById("g1")?.ownTimingInstances).toBeUndefined();
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
    expect(lineById("c2")?.words?.[1]?.begin).toBeCloseTo(70.5, 6);
  });

  it("is one undo step", () => {
    seed(
      [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1, 2] })],
      [chorus(0, 10), chorus(1, 40, 0.3), chorus(2, 70, -0.2)],
    );
    store().shareGroupTiming("g1", SONG_LENGTH);
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
    expect(lineById("c2")?.words?.[1]?.begin).toBeCloseTo(70.5, 6);
    store().undo();
    expect(groupById("g1")?.ownTimingInstances).toEqual([1, 2]);
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.8, 6);
    expect(lineById("c2")?.words?.[1]?.begin).toBeCloseTo(70.3, 6);
  });

  describe("edge cases", () => {
    it("takes the only timed instance as the source and shares the untimed one", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [0, 1] })], [chorus(0), chorus(1, 40)]);
      store().shareGroupTiming("g1", SONG_LENGTH);
      expect(groupById("g1")?.ownTimingInstances).toBeUndefined();
      expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
    });

    it("reports why an instance kept its own timing", () => {
      const firstWordOnly = (instanceIdx: number, begin: number, end: number) =>
        createLine({ ...chorus(instanceIdx), words: [{ text: "I ", begin, end }] });
      seed([createGroup({ id: "g1" })], [chorus(0), firstWordOnly(1, 40, 40.4), firstWordOnly(2, 70, 70.6)]);
      expect(store().shareGroupTiming("g1", SONG_LENGTH).keptOwnTiming).toEqual([
        { instanceIdx: 2, refusal: "no-fully-synced-instance" },
      ]);
    });

    it("changes nothing for an unknown group", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40)]);
      const before = store();
      expect(store().shareGroupTiming("missing", SONG_LENGTH)).toEqual({ keptOwnTiming: [], replaced: [] });
      expect(store().lines).toBe(before.lines);
      expect(store().groups).toBe(before.groups);
    });
  });

  describe("invariants", () => {
    it("does not move instances that already shared timing", () => {
      seed(
        [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })],
        [chorus(0, 10), chorus(1, 40, 0.3), chorus(2, 70)],
      );
      const sharedBefore = lineById("c2");
      store().shareGroupTiming("g1", SONG_LENGTH);
      expect(lineById("c0")?.words).toEqual(chorus(0, 10).words);
      expect(lineById("c2")).toBe(sharedBefore);
    });
  });
});

describe("placeInstance", () => {
  it("fills an unplaced instance at the start as one undo step", () => {
    seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1)]);
    store().placeInstance("g1", 1, 40, SONG_LENGTH);
    expect(lineById("c1")?.words?.[0]?.begin).toBeCloseTo(40, 6);
    store().undo();
    expect(lineById("c1")?.words).toBeUndefined();
  });

  it("moves a placed instance without moving the others", () => {
    seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1, 40)]);
    expect(store().placeInstance("g1", 1, 50, SONG_LENGTH)).toBe(true);
    expect(lineById("c1")?.words?.[0]?.begin).toBeCloseTo(50, 6);
    expect(lineById("c0")?.words?.[0]?.begin).toBeCloseTo(10, 6);
  });

  it("applies the preceding updates and the placement as one undo step", () => {
    const verse = createLine({ id: "v", text: "Walking", words: [{ text: "Walking", begin: 20, end: 21 }] });
    seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), verse, chorus(1)]);
    const preceding = [{ id: "v", updates: { words: [{ text: "Walking", begin: 20, end: 39 }] } }];
    expect(store().placeInstance("g1", 1, 40, SONG_LENGTH, preceding)).toBe(true);
    expect(lineById("v")?.words?.[0]?.end).toBe(39);
    expect(lineById("c1")?.words?.[0]?.begin).toBeCloseTo(40, 6);
    store().undo();
    expect(lineById("v")?.words?.[0]?.end).toBe(21);
    expect(lineById("c1")?.words).toBeUndefined();
  });

  it("copies a preceding edit on a shared instance before placing, so the placed copy includes it", () => {
    seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1)]);
    const closeLastWord = {
      id: "c0",
      updates: {
        words: [
          { text: "I ", begin: 10, end: 10.4 },
          { text: "want", begin: 10.5, end: 12 },
        ],
      },
    };
    store().placeInstance("g1", 1, 40, SONG_LENGTH, [closeLastWord]);
    expect(lineById("c1")?.words?.[1]?.end).toBeCloseTo(42, 6);
  });

  it("keeps the line text, because placing only writes timing", () => {
    const partial = createLine({ id: "p", text: "one two three", words: [{ text: "one ", begin: 1, end: 2 }] });
    seed([createGroup({ id: "g1", sharesTiming: true })], [partial, chorus(0, 10), chorus(1)]);
    store().placeInstance("g1", 1, 40, SONG_LENGTH);
    expect(lineById("p")?.text).toBe("one two three");
  });

  describe("edge cases", () => {
    it("writes nothing and reports false when the instance would run past the song end", () => {
      seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1)]);
      const before = store().lines;
      expect(store().placeInstance("g1", 1, 99.5, 100)).toBe(false);
      expect(store().lines).toBe(before);
    });

    it("places an instance that ends exactly at the song end", () => {
      seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1)]);
      expect(store().placeInstance("g1", 1, 99, 100)).toBe(true);
    });

    it("places without an end limit while the song length is unknown", () => {
      seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1)]);
      expect(store().placeInstance("g1", 1, 500, 0)).toBe(true);
    });

    it("pings the groups a preceding edit reached only when the placement lands", () => {
      const lastWordLonger = {
        id: "c0",
        updates: {
          words: [
            { text: "I ", begin: 10, end: 10.4 },
            { text: "want", begin: 10.5, end: 12 },
          ],
        },
      };
      const pings: (readonly string[])[] = [];
      const unsubscribe = subscribeSharedTimingCopied((groupIds) => pings.push(groupIds));
      try {
        seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1), chorus(2, 60)]);
        expect(store().placeInstance("g1", 1, 99.5, 100, [lastWordLonger])).toBe(false);
        expect(pings).toEqual([]);
        expect(store().placeInstance("g1", 1, 40, SONG_LENGTH, [lastWordLonger])).toBe(true);
        expect(pings).toEqual([["g1"]]);
      } finally {
        unsubscribe();
      }
    });

    it("writes nothing and reports false when there is no timed reference", () => {
      seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0), chorus(1)]);
      const before = store().lines;
      const firstWordOnly = { id: "c0", updates: { words: [{ text: "I ", begin: 1, end: 2 }] } };
      expect(store().placeInstance("g1", 1, 40, SONG_LENGTH, [firstWordOnly])).toBe(false);
      expect(store().lines).toBe(before);
    });
  });
});

describe("addInstance", () => {
  it("shares a new instance that reuses the index of a removed own-timing instance", () => {
    seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10)]);
    store().addInstance("g1", [{ text: "I want", agentId: "v1" }], 40);
    const added = store().lines.find((line) => line.id !== "c0");
    expect(added?.instanceIdx).toBe(1);
    expect(groupById("g1")?.ownTimingInstances).toBeUndefined();
  });
});
