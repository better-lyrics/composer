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

  it("parts stay one stretch each when lines move", () => {
    const verseAndChorus: Part[] = [
      { id: "A", lineIds: ["a1", "a2", "a3"] },
      { id: "B", lineIds: ["b1", "b2"] },
    ];
    const before = ["x", "a1", "a2", "a3", "b1", "b2", "y"];
    const lineIds = (parts: readonly Part[]) => parts.map((part) => part.lineIds);
    expect(lineIds(partsAfterLineChange(verseAndChorus, before, ["x", "a1", "b1", "a2", "a3", "b2", "y"]))).toEqual([
      ["a1", "b1", "a2", "a3"],
      ["b2"],
    ]);
    expect(lineIds(partsAfterLineChange(verseAndChorus, before, ["x", "b1", "b2", "a1", "a2", "a3", "y"]))).toEqual([
      ["a1", "a2", "a3"],
      ["b1", "b2"],
    ]);
  });

  it("sections nested in a part follow its lines by the same rule", () => {
    const verse: Part[] = [
      {
        id: "A",
        kind: "Verse",
        lineIds: ["a1", "a2", "a3"],
        sections: [{ kind: "Hook", lineIds: ["a1", "a2"] }, { lineIds: ["a3"] }],
      },
    ];
    const [inserted] = partsAfterLineChange(verse, ["a1", "a2", "a3"], ["a1", "n", "a2", "a3"]);
    expect(inserted.sections?.map((section) => section.lineIds)).toEqual([["a1", "n", "a2"], ["a3"]]);
    const [deleted] = partsAfterLineChange(verse, ["a1", "a2", "a3"], ["a1", "a2"]);
    expect(deleted.sections).toEqual([{ kind: "Hook", lineIds: ["a1", "a2"] }]);
  });
});
