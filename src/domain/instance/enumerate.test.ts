import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import { instanceIndicesOf, linesOfInstance } from "@/domain/instance/enumerate";

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
