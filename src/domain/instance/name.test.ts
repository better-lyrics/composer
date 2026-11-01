import { instanceName } from "@/domain/instance/name";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const group = createGroup({ id: "g1", label: "Chorus" });
const member = (instanceIdx: number) => createLine({ text: "go", groupId: "g1", instanceIdx, templateLineIdx: 0 });

describe("instanceName", () => {
  it("names an instance by the group label and its ordinal", () => {
    const lines = [member(0), member(1), member(2)];
    expect(instanceName(lines, group, 1)).toBe("Chorus 2");
  });

  describe("edge cases", () => {
    it("keeps the ordinal apart from a label that ends in a number", () => {
      const lines = [member(0), member(1), member(2)];
      expect(instanceName(lines, createGroup({ id: "g1", label: "Group 1" }), 2)).toBe("Group 1 #3");
    });

    it("counts ordinals over the instance indices that remain", () => {
      const lines = [member(0), member(3)];
      expect(instanceName(lines, group, 3)).toBe("Chorus 2");
    });
  });
});
