import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import {
  instanceCount,
  instanceIndicesOf,
  instanceOrdinal,
  instancePositionsByLineId,
  linesOfInstance,
  nextInstanceIdx,
} from "@/domain/instance/enumerate";
import { isLinked } from "@/domain/instance/predicates";

// -- Helpers ------------------------------------------------------------------

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello", agentId: "v1", ...extras });
}

// -- linesOfInstance ----------------------------------------------------------

describe("linesOfInstance", () => {
  it("returns lines matching both groupId and instanceIdx", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 0 }),
      line({ id: "b", groupId: "g1", instanceIdx: 0 }),
      line({ id: "c", groupId: "g1", instanceIdx: 1 }),
      line({ id: "d", groupId: "g2", instanceIdx: 0 }),
    ];
    expect(linesOfInstance(lines, "g1", 0).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("preserves the original order", () => {
    const lines: LyricLine[] = [
      line({ id: "c", groupId: "g1", instanceIdx: 0 }),
      line({ id: "a", groupId: "g1", instanceIdx: 0 }),
      line({ id: "b", groupId: "g1", instanceIdx: 0 }),
    ];
    expect(linesOfInstance(lines, "g1", 0).map((l) => l.id)).toEqual(["c", "a", "b"]);
  });

  it("returns empty array when no line matches", () => {
    const lines: LyricLine[] = [line({ id: "a", groupId: "g1", instanceIdx: 0 })];
    expect(linesOfInstance(lines, "g2", 0)).toEqual([]);
  });

  it("returns empty array for standalone lines (no groupId)", () => {
    const lines: LyricLine[] = [line({ id: "a" }), line({ id: "b" })];
    expect(linesOfInstance(lines, "g1", 0)).toEqual([]);
  });

  it("excludes lines missing instanceIdx even if groupId matches", () => {
    const lines: LyricLine[] = [line({ id: "a", groupId: "g1", instanceIdx: 0 }), line({ id: "b", groupId: "g1" })];
    expect(linesOfInstance(lines, "g1", 0).map((l) => l.id)).toEqual(["a"]);
  });
});

// -- instanceIndicesOf --------------------------------------------------------

describe("instanceIndicesOf", () => {
  it("returns each instance index once, ascending", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 2 }),
      line({ id: "b", groupId: "g1", instanceIdx: 0 }),
      line({ id: "c", groupId: "g1", instanceIdx: 2 }),
      line({ id: "d", groupId: "g1", instanceIdx: 1 }),
    ];
    expect(instanceIndicesOf(lines, "g1")).toEqual([0, 1, 2]);
  });

  it("ignores other groups and standalone lines", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 0 }),
      line({ id: "b", groupId: "g2", instanceIdx: 5 }),
      line({ id: "c" }),
    ];
    expect(instanceIndicesOf(lines, "g1")).toEqual([0]);
  });

  it("excludes lines missing instanceIdx", () => {
    const lines: LyricLine[] = [line({ id: "a", groupId: "g1" })];
    expect(instanceIndicesOf(lines, "g1")).toEqual([]);
  });

  it("returns an empty array for an unknown group", () => {
    expect(instanceIndicesOf([line({ id: "a", groupId: "g1", instanceIdx: 0 })], "nope")).toEqual([]);
  });

  it("sorts numerically, not lexicographically", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 10 }),
      line({ id: "b", groupId: "g1", instanceIdx: 2 }),
    ];
    expect(instanceIndicesOf(lines, "g1")).toEqual([2, 10]);
  });
});

// -- nextInstanceIdx ----------------------------------------------------------

describe("nextInstanceIdx", () => {
  function withIndices(indices: number[], groupId = "g1"): LyricLine[] {
    return indices.map((instanceIdx, i) => line({ id: `${groupId}-${i}`, groupId, instanceIdx }));
  }

  it("starts at zero for a group with no instances", () => {
    expect(nextInstanceIdx([], "g1")).toBe(0);
    expect(nextInstanceIdx(withIndices([0, 1], "g2"), "g1")).toBe(0);
  });

  it("appends after a contiguous run", () => {
    expect(nextInstanceIdx(withIndices([0]), "g1")).toBe(1);
    expect(nextInstanceIdx(withIndices([0, 1, 2]), "g1")).toBe(3);
  });

  it("fills a hole left by a deleted instance", () => {
    expect(nextInstanceIdx(withIndices([0, 2]), "g1")).toBe(1);
    expect(nextInstanceIdx(withIndices([0, 1, 3, 4]), "g1")).toBe(2);
  });

  it("fills index zero when the run does not start there", () => {
    expect(nextInstanceIdx(withIndices([1, 2]), "g1")).toBe(0);
    expect(nextInstanceIdx(withIndices([5]), "g1")).toBe(0);
  });

  it("counts an instance once however many lines it spans", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 0 }),
      line({ id: "b", groupId: "g1", instanceIdx: 0 }),
      line({ id: "c", groupId: "g1", instanceIdx: 1 }),
      line({ id: "d", groupId: "g1", instanceIdx: 1 }),
    ];
    expect(nextInstanceIdx(lines, "g1")).toBe(2);
  });

  describe("edge cases", () => {
    it("ignores other groups, standalone lines, and lines missing instanceIdx", () => {
      const lines: LyricLine[] = [
        line({ id: "a", groupId: "g1", instanceIdx: 0 }),
        line({ id: "b", groupId: "g2", instanceIdx: 1 }),
        line({ id: "c", groupId: "g1" }),
        line({ id: "d" }),
      ];
      expect(nextInstanceIdx(lines, "g1")).toBe(1);
    });

    it("is unaffected by the order the lines appear in", () => {
      expect(nextInstanceIdx(withIndices([3, 0, 2]), "g1")).toBe(1);
      expect(nextInstanceIdx(withIndices([2, 3, 0]), "g1")).toBe(1);
    });

    it("skips past a sparse tail rather than reusing a far index", () => {
      expect(nextInstanceIdx(withIndices([0, 1, 2, 99]), "g1")).toBe(3);
    });
  });

  describe("invariants", () => {
    it("never returns an index already in use", () => {
      const cases = [[], [0], [1], [0, 1], [0, 2], [1, 2], [0, 1, 3], [2, 5, 7], [0, 1, 2, 3]];
      for (const indices of cases) {
        const lines = withIndices(indices);
        expect(indices).not.toContain(nextInstanceIdx(lines, "g1"));
      }
    });

    it("does not modify its input", () => {
      const lines = withIndices([0, 2]);
      const snapshot = structuredClone(lines);
      nextInstanceIdx(lines, "g1");
      expect(lines).toEqual(snapshot);
    });
  });
});

// -- instanceOrdinal / instanceCount -------------------------------------------

describe("instanceOrdinal", () => {
  it("ranks an instance among the surviving instances after a removal leaves a gap", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 1 }),
      line({ id: "b", groupId: "g1", instanceIdx: 3 }),
      line({ id: "c", groupId: "g1", instanceIdx: 3 }),
    ];
    expect(instanceOrdinal(lines, "g1", 1)).toBe(1);
    expect(instanceOrdinal(lines, "g1", 3)).toBe(2);
  });

  it("is 1 for the only instance, whatever its stored index", () => {
    const lines: LyricLine[] = [line({ id: "a", groupId: "g1", instanceIdx: 1 })];
    expect(instanceOrdinal(lines, "g1", 1)).toBe(1);
  });

  it("ignores instances of other groups", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g2", instanceIdx: 0 }),
      line({ id: "b", groupId: "g1", instanceIdx: 2 }),
    ];
    expect(instanceOrdinal(lines, "g1", 2)).toBe(1);
  });
});

describe("instanceCount", () => {
  it("counts distinct surviving instances of the group", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 1 }),
      line({ id: "b", groupId: "g1", instanceIdx: 3 }),
      line({ id: "c", groupId: "g1", instanceIdx: 3 }),
      line({ id: "d", groupId: "g2", instanceIdx: 0 }),
    ];
    expect(instanceCount(lines, "g1")).toBe(2);
  });

  it("is 0 when the group has no lines", () => {
    expect(instanceCount([line()], "g1")).toBe(0);
  });

  it("never falls below the ordinal of any surviving instance", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 4 }),
      line({ id: "b", groupId: "g1", instanceIdx: 9 }),
    ];
    for (const idx of [4, 9]) expect(instanceOrdinal(lines, "g1", idx)).toBeLessThanOrEqual(instanceCount(lines, "g1"));
  });
});

describe("instancePositionsByLineId", () => {
  it("gives every linked line its instance ordinal and its group's instance count", () => {
    const lines: LyricLine[] = [
      line({ id: "a", groupId: "g1", instanceIdx: 3 }),
      line({ id: "b", groupId: "g2", instanceIdx: 0 }),
      line({ id: "c", groupId: "g1", instanceIdx: 1 }),
      line({ id: "d", groupId: "g1", instanceIdx: 3 }),
    ];
    const positions = instancePositionsByLineId(lines);
    expect(positions.get("a")).toEqual({ ordinal: 2, count: 2 });
    expect(positions.get("b")).toEqual({ ordinal: 1, count: 1 });
    expect(positions.get("c")).toEqual({ ordinal: 1, count: 2 });
    expect(positions.get("d")).toEqual({ ordinal: 2, count: 2 });
  });

  describe("edge cases", () => {
    it("skips standalone lines", () => {
      expect(instancePositionsByLineId([line({ id: "s" })]).has("s")).toBe(false);
    });

    it("is empty for no lines", () => {
      expect(instancePositionsByLineId([]).size).toBe(0);
    });
  });

  describe("invariants", () => {
    it("agrees with instanceOrdinal and instanceCount for every linked line", () => {
      const lines: LyricLine[] = [
        line({ id: "a", groupId: "g1", instanceIdx: 4 }),
        line({ id: "b", groupId: "g1", instanceIdx: 9 }),
        line({ id: "c", groupId: "g2", instanceIdx: 2 }),
        line({ id: "d", groupId: "g1", instanceIdx: 0 }),
      ];
      const positions = instancePositionsByLineId(lines);
      for (const l of lines) {
        if (!isLinked(l)) continue;
        expect(positions.get(l.id)).toEqual({
          ordinal: instanceOrdinal(lines, l.groupId, l.instanceIdx),
          count: instanceCount(lines, l.groupId),
        });
      }
    });
  });
});
