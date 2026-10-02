import { withNewInstance } from "@/domain/group/own-timing";
import { createGroup } from "@/test/factories";
import { describe, expect, it } from "vitest";

describe("withNewInstance", () => {
  it("shares a new instance that reuses the index of a removed own-timing instance", () => {
    const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1, 3] })];
    expect(withNewInstance(groups, "g1", 1)[0]).toMatchObject({ sharesTiming: true, ownTimingInstances: [3] });
  });

  it("leaves other groups unchanged", () => {
    const other = createGroup({ id: "g2", sharesTiming: true, ownTimingInstances: [1] });
    const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] }), other];
    expect(withNewInstance(groups, "g1", 1)[1]).toBe(other);
  });

  describe("edge cases", () => {
    it("keeps an old group old", () => {
      const groups = [createGroup({ id: "g1" })];
      expect(withNewInstance(groups, "g1", 1)[0].sharesTiming).toBeUndefined();
    });

    it("drops an empty own-timing list", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [2] })];
      expect(withNewInstance(groups, "g1", 2)[0].ownTimingInstances).toBeUndefined();
    });

    it("returns the groups unchanged for an unknown group", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      expect(withNewInstance(groups, "missing", 1)).toEqual(groups);
    });
  });

  describe("invariants", () => {
    it("does not mutate the input", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1] })];
      const snapshot = structuredClone(groups);
      withNewInstance(groups, "g1", 1);
      expect(groups).toEqual(snapshot);
    });
  });
});
