/**
 * @vitest-environment node
 */
import { computeSyllableGroups, getSyllablePositions } from "@/utils/syllable-groups";
import { describe, expect, it } from "vitest";

// -- id-mode -------------------------------------------------------------------

describe("getSyllablePositions · id-mode", () => {
  it("groups a contiguous run of words sharing a syllableGroupId", () => {
    const positions = getSyllablePositions([
      { text: "hello ", begin: 0, end: 1 },
      { text: "ev", begin: 1, end: 1.2, syllableGroupId: "g1" },
      { text: "er", begin: 1.2, end: 1.5, syllableGroupId: "g1" },
      { text: "y", begin: 1.5, end: 1.8, syllableGroupId: "g1" },
      { text: "world", begin: 1.8, end: 2.5 },
    ]);
    expect(positions).toEqual(["none", "first", "middle", "last", "none"]);
  });

  it("ignores trailing-space pattern when any word in the array has an id", () => {
    const positions = getSyllablePositions([
      { text: "ev ", begin: 0, end: 0.2, syllableGroupId: "g1" },
      { text: "er ", begin: 0.2, end: 0.4, syllableGroupId: "g1" },
      { text: "y", begin: 0.4, end: 0.6, syllableGroupId: "g1" },
    ]);
    expect(positions).toEqual(["first", "middle", "last"]);
  });

  it("does not group a single-word id run", () => {
    const positions = getSyllablePositions([
      { text: "hello", begin: 0, end: 1, syllableGroupId: "g1" },
      { text: "world", begin: 1, end: 2 },
    ]);
    expect(positions).toEqual(["none", "none"]);
  });

  it("breaks contiguity when adjacent ids differ", () => {
    const positions = getSyllablePositions([
      { text: "ev", begin: 0, end: 0.2, syllableGroupId: "g1" },
      { text: "er", begin: 0.2, end: 0.4, syllableGroupId: "g2" },
    ]);
    expect(positions).toEqual(["none", "none"]);
  });

  it("supports multiple distinct groups in the same array", () => {
    const positions = getSyllablePositions([
      { text: "ev", begin: 0, end: 0.2, syllableGroupId: "g1" },
      { text: "er", begin: 0.2, end: 0.5, syllableGroupId: "g1" },
      { text: "world", begin: 0.5, end: 1 },
      { text: "wi", begin: 1, end: 1.2, syllableGroupId: "g2" },
      { text: "de", begin: 1.2, end: 1.5, syllableGroupId: "g2" },
    ]);
    expect(positions).toEqual(["first", "last", "none", "first", "last"]);
  });

  it("treats a standalone id-d word among id-d siblings as 'none'", () => {
    const positions = getSyllablePositions([
      { text: "lone", begin: 0, end: 1, syllableGroupId: "g0" },
      { text: "wo", begin: 1, end: 1.5, syllableGroupId: "g1" },
      { text: "rd", begin: 1.5, end: 2, syllableGroupId: "g1" },
    ]);
    expect(positions).toEqual(["none", "first", "last"]);
  });
});

// -- trailing-space fallback ---------------------------------------------------

describe("getSyllablePositions · trailing-space fallback", () => {
  it("falls back to trailing-space heuristic when no word has an id", () => {
    const positions = getSyllablePositions([
      { text: "ev", begin: 0, end: 0.2 },
      { text: "er", begin: 0.2, end: 0.4 },
      { text: "y ", begin: 0.4, end: 0.6 },
      { text: "world", begin: 0.6, end: 1 },
    ]);
    expect(positions).toEqual(["first", "middle", "last", "none"]);
  });

  it("returns all 'none' for a single standalone word with no ids", () => {
    const positions = getSyllablePositions([{ text: "hello", begin: 0, end: 1 }]);
    expect(positions).toEqual(["none"]);
  });

  it("returns empty array for empty input", () => {
    expect(getSyllablePositions([])).toEqual([]);
  });
});

// -- computeSyllableGroups (lower-level invariants) ----------------------------

describe("computeSyllableGroups · id-mode", () => {
  it("emits one group per contiguous same-id run", () => {
    const groups = computeSyllableGroups([
      { text: "ev", begin: 0, end: 0.2, syllableGroupId: "g1" },
      { text: "er", begin: 0.2, end: 0.5, syllableGroupId: "g1" },
      { text: "world", begin: 0.5, end: 1 },
      { text: "wi", begin: 1, end: 1.2, syllableGroupId: "g2" },
      { text: "de", begin: 1.2, end: 1.5, syllableGroupId: "g2" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ startIndex: 0, endIndex: 1 });
    expect(groups[1]).toMatchObject({ startIndex: 3, endIndex: 4 });
  });

  it("joins originalWord ignoring trailing spaces", () => {
    const groups = computeSyllableGroups([
      { text: "ev ", begin: 0, end: 0.2, syllableGroupId: "g1" },
      { text: "er ", begin: 0.2, end: 0.4, syllableGroupId: "g1" },
      { text: "y", begin: 0.4, end: 0.6, syllableGroupId: "g1" },
    ]);
    expect(groups[0].originalWord).toBe("every");
  });
});
