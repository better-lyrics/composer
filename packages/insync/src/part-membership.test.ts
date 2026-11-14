import { describe, expect, it } from "vitest";
import type { Part } from "./part";
import { partsAfterLineChange } from "./part-membership";

describe("partsAfterLineChange", () => {
  const parts: Part[] = [{ id: "p1", kind: "Chorus", lineIds: ["a", "b"] }];

  it("a line inserted inside a part joins it, at its edge it does not", () => {
    expect(partsAfterLineChange(parts, ["a", "b"], ["a", "n", "b"])[0].lineIds).toEqual(["a", "n", "b"]);
    expect(partsAfterLineChange(parts, ["a", "b"], ["a", "b", "n"])[0].lineIds).toEqual(["a", "b"]);
    expect(partsAfterLineChange(parts, ["a", "b"], ["c"])).toEqual([]);
  });

  it("several lines pasted inside a part all join it", () => {
    expect(partsAfterLineChange(parts, ["a", "b"], ["a", "n1", "n2", "b"])[0].lineIds).toEqual(["a", "n1", "n2", "b"]);
  });

  it("keeps the parts it was given when no line came or went", () => {
    expect(partsAfterLineChange(parts, ["a", "b"], ["a", "b"])).toBe(parts);
    expect(partsAfterLineChange(parts, ["a", "b", "x"], ["a", "b", "y"])).toBe(parts);
  });
});
