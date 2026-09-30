import { isSharedLine, sharedInstancesInLineOrder, sharesTiming } from "@/domain/group/shared-timing";
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
