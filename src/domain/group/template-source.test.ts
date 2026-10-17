import { pickedTemplateSource, templateSourceInstance } from "@/domain/group/template-source";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const chorus = (instanceIdx: number, begin?: number) =>
  createLine({
    id: `c${instanceIdx}`,
    text: "I want",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    ...(begin === undefined
      ? {}
      : {
          words: [
            { text: "I ", begin, end: begin + 0.4 },
            { text: "want", begin: begin + 0.5, end: begin + 1 },
          ],
        }),
  });

describe("templateSourceInstance", () => {
  it("takes the first fully timed shared instance", () => {
    const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [0] });
    expect(templateSourceInstance([chorus(0, 10), chorus(1), chorus(2, 40)], group, 0)).toBe(2);
  });

  it("keeps the fallback for an old group", () => {
    const group = createGroup({ id: "g1" });
    expect(templateSourceInstance([chorus(0, 10), chorus(1, 40)], group, 1)).toBe(1);
  });

  describe("edge cases", () => {
    it("takes the first shared instance when none is timed", () => {
      const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [0] });
      expect(templateSourceInstance([chorus(0, 10), chorus(1), chorus(2)], group, 0)).toBe(1);
    });

    it("keeps the fallback when every instance has its own timing", () => {
      const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [0, 1] });
      expect(templateSourceInstance([chorus(0, 10), chorus(1, 40)], group, 1)).toBe(1);
    });

    it("keeps the fallback for a missing group", () => {
      expect(templateSourceInstance([chorus(0, 10)], undefined, 0)).toBe(0);
    });
  });
});

describe("pickedTemplateSource", () => {
  it("keeps a picked shared instance", () => {
    const group = createGroup({ id: "g1", sharesTiming: true });
    expect(pickedTemplateSource([chorus(0, 10), chorus(1, 40)], group, 1)).toBe(1);
  });

  it("keeps the pick in an old group", () => {
    expect(pickedTemplateSource([chorus(0, 10), chorus(1, 40)], createGroup({ id: "g1" }), 1)).toBe(1);
  });

  it("takes the shared timing when the pick has its own timing", () => {
    const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] });
    expect(pickedTemplateSource([chorus(0, 10), chorus(1, 40)], group, 1)).toBe(0);
  });

  describe("edge cases", () => {
    it("keeps the pick when the group is missing", () => {
      expect(pickedTemplateSource([chorus(0, 10)], undefined, 0)).toBe(0);
    });
  });
});
