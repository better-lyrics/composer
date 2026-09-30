/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
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

  it("shares timing in a new group when the setting is on", () => {
    seed([], [plain("a", 10), plain("b", 40)]);
    store().groupRepeatingSections([0, 1], 1);
    expect(store().groups[0]).toMatchObject({ sharesTiming: true });
    expect(store().groups[0].ownTimingInstances).toBeUndefined();
  });

  it("gives instances with different timing their own timing", () => {
    seed([], [plain("a", 10), plain("b", 40, 0.3)]);
    store().groupRepeatingSections([0, 1], 1);
    expect(store().groups[0]).toMatchObject({ sharesTiming: true, ownTimingInstances: [1] });
  });

  it("creates an old group when the setting is off", () => {
    useSettingsStore.setState({ shareTimingInNewGroups: false });
    seed([], [plain("a", 10), plain("b", 40)]);
    store().groupRepeatingSections([0, 1], 1);
    expect(store().groups[0].sharesTiming).toBeUndefined();
  });

  it("never writes timing", () => {
    seed([], [plain("a", 10), plain("b")]);
    store().groupRepeatingSections([0, 1], 1);
    expect(lineById("b")?.words).toBeUndefined();
  });
});

describe("setInstanceOwnTiming", () => {
  it("gives an instance its own timing without moving it", () => {
    seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1, 40)]);
    const linesBefore = store().lines;
    store().setInstanceOwnTiming("g1", 1, true);
    expect(groupById("g1")?.ownTimingInstances).toEqual([1]);
    expect(store().lines).toEqual(linesBefore);
  });

  it("shares an instance again and takes the shared timing at its start", () => {
    seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40, 0.3)]);
    store().setInstanceOwnTiming("g1", 1, false);
    expect(groupById("g1")?.ownTimingInstances).toBeUndefined();
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
  });

  it("is one undo step", () => {
    seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40, 0.3)]);
    store().setInstanceOwnTiming("g1", 1, false);
    store().undo();
    expect(groupById("g1")?.ownTimingInstances).toEqual([1]);
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.8, 6);
  });

  describe("edge cases", () => {
    it("leaves an unplaced instance unplaced when shared again", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1)]);
      store().setInstanceOwnTiming("g1", 1, false);
      expect(lineById("c1")?.words).toBeUndefined();
    });

    it("does not list an instance twice", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40)]);
      store().setInstanceOwnTiming("g1", 1, true);
      expect(groupById("g1")?.ownTimingInstances).toEqual([1]);
    });
  });
});

describe("shareGroupTiming", () => {
  it("opts an old group in and changes only the group fields", () => {
    seed([createGroup({ id: "g1" })], [chorus(0, 10), chorus(1, 40, 0.3), chorus(2)]);
    const linesBefore = store().lines;
    store().shareGroupTiming("g1");
    expect(groupById("g1")).toMatchObject({ sharesTiming: true, ownTimingInstances: [1] });
    expect(store().lines).toEqual(linesBefore);
  });

  it("opts in even when the setting is off", () => {
    useSettingsStore.setState({ shareTimingInNewGroups: false });
    seed([createGroup({ id: "g1" })], [chorus(0, 10), chorus(1, 40)]);
    store().shareGroupTiming("g1");
    expect(groupById("g1")?.sharesTiming).toBe(true);
  });
});

describe("placeInstance", () => {
  it("fills an unplaced instance at the start as one undo step", () => {
    seed([createGroup({ id: "g1", sharesTiming: true })], [chorus(0, 10), chorus(1)]);
    store().placeInstance("g1", 1, 40);
    expect(lineById("c1")?.words?.[0]?.begin).toBeCloseTo(40, 6);
    store().undo();
    expect(lineById("c1")?.words).toBeUndefined();
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

describe("shareAllInstances", () => {
  it("shares every instance and gives each one the shared timing at its start", () => {
    seed(
      [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1, 2] })],
      [chorus(0, 10), chorus(1, 40, 0.3), chorus(2, 70, -0.2)],
    );
    store().shareAllInstances("g1");
    expect(groupById("g1")).toMatchObject({ sharesTiming: true });
    expect(groupById("g1")?.ownTimingInstances).toBeUndefined();
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
    expect(lineById("c2")?.words?.[1]?.begin).toBeCloseTo(70.5, 6);
  });

  it("is one undo step", () => {
    seed(
      [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1, 2] })],
      [chorus(0, 10), chorus(1, 40, 0.3), chorus(2, 70, -0.2)],
    );
    store().shareAllInstances("g1");
    store().undo();
    expect(groupById("g1")?.ownTimingInstances).toEqual([1, 2]);
    expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.8, 6);
    expect(lineById("c2")?.words?.[1]?.begin).toBeCloseTo(70.3, 6);
  });

  describe("edge cases", () => {
    it("leaves an unplaced instance unplaced", () => {
      seed(
        [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1, 2] })],
        [chorus(0, 10), chorus(1, 40, 0.3), chorus(2)],
      );
      store().shareAllInstances("g1");
      expect(lineById("c2")?.words).toBeUndefined();
      expect(lineById("c1")?.words?.[1]?.begin).toBeCloseTo(40.5, 6);
    });

    it("changes nothing for an unknown group", () => {
      seed([createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })], [chorus(0, 10), chorus(1, 40)]);
      const before = store();
      store().shareAllInstances("missing");
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
      store().shareAllInstances("g1");
      expect(lineById("c0")?.words).toEqual(chorus(0, 10).words);
      expect(lineById("c2")).toBe(sharedBefore);
    });
  });
});
