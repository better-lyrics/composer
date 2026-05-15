/**
 * @vitest-environment node
 */
import type { LyricLine } from "@/stores/project";
import { describe, expect, it } from "vitest";
import { applyShiftDragCrossTrack } from "./apply-shift-drag-cross-track";

const DURATION = 30;

describe("applyShiftDragCrossTrack", () => {
  it("dissolves the entire source group when moving one syllable main → bg", () => {
    const line: LyricLine = {
      id: "l1",
      text: "every",
      agentId: "v1",
      words: [
        { text: "ev", begin: 0, end: 0.3, syllableGroupId: "g" },
        { text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g" },
        { text: "y ", begin: 0.6, end: 0.9, syllableGroupId: "g" },
      ],
    };

    const result = applyShiftDragCrossTrack(line, "word", 1, 5, DURATION);

    expect(result).not.toBeNull();
    expect(result?.words?.length).toBe(2);
    expect(result?.words?.[0].text).toBe("ev");
    expect(result?.words?.[1].text).toBe("y");
    expect(result?.words?.[0].syllableGroupId).toBeUndefined();
    expect(result?.words?.[1].syllableGroupId).toBeUndefined();

    expect(result?.backgroundWords?.length).toBe(1);
    expect(result?.backgroundWords?.[0].text).toBe("er");
    expect(result?.backgroundWords?.[0].syllableGroupId).toBeUndefined();
    expect(result?.backgroundWords?.[0].begin).toBeCloseTo(5.3, 5);
  });

  it("leaves the surviving syllables' timing intact (no absorb)", () => {
    const line: LyricLine = {
      id: "l1",
      text: "every",
      agentId: "v1",
      words: [
        { text: "ev", begin: 0, end: 0.3, syllableGroupId: "g" },
        { text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g" },
        { text: "y ", begin: 0.6, end: 0.9, syllableGroupId: "g" },
      ],
    };

    const result = applyShiftDragCrossTrack(line, "word", 1, 5, DURATION);

    expect(result?.words?.[0].begin).toBeCloseTo(0, 5);
    expect(result?.words?.[0].end).toBeCloseTo(0.3, 5);
    expect(result?.words?.[1].begin).toBeCloseTo(0.6, 5);
    expect(result?.words?.[1].end).toBeCloseTo(0.9, 5);
  });

  it("only dissolves the dragged word's group, leaving other groups in the line intact", () => {
    const line: LyricLine = {
      id: "l1",
      text: "every wide",
      agentId: "v1",
      words: [
        { text: "ev", begin: 0, end: 0.2, syllableGroupId: "g1" },
        { text: "er", begin: 0.2, end: 0.4, syllableGroupId: "g1" },
        { text: "y ", begin: 0.4, end: 0.6, syllableGroupId: "g1" },
        { text: "wi", begin: 0.6, end: 0.8, syllableGroupId: "g2" },
        { text: "de", begin: 0.8, end: 1, syllableGroupId: "g2" },
      ],
    };

    const result = applyShiftDragCrossTrack(line, "word", 1, 5, DURATION);

    expect(result?.words?.length).toBe(4);
    expect(result?.words?.[0].syllableGroupId).toBeUndefined();
    expect(result?.words?.[1].syllableGroupId).toBeUndefined();
    const wi = result?.words?.find((w) => w.text === "wi");
    const de = result?.words?.find((w) => w.text === "de");
    expect(wi?.syllableGroupId).toBe("g2");
    expect(de?.syllableGroupId).toBe("g2");
  });

  it("dissolves the source group when moving one syllable bg → main", () => {
    const line: LyricLine = {
      id: "l1",
      text: "main",
      agentId: "v1",
      words: [{ text: "main", begin: 0, end: 0.5 }],
      backgroundText: "every",
      backgroundWords: [
        { text: "ev", begin: 1, end: 1.3, syllableGroupId: "g" },
        { text: "er", begin: 1.3, end: 1.6, syllableGroupId: "g" },
        { text: "y", begin: 1.6, end: 1.9, syllableGroupId: "g" },
      ],
    };

    const result = applyShiftDragCrossTrack(line, "bg", 1, 5, DURATION);

    expect(result?.backgroundWords?.length).toBe(2);
    expect(result?.backgroundWords?.[0].text).toBe("ev");
    expect(result?.backgroundWords?.[0].syllableGroupId).toBeUndefined();
    expect(result?.backgroundWords?.[1].text).toBe("y");
    expect(result?.backgroundWords?.[1].syllableGroupId).toBeUndefined();

    expect(result?.words?.length).toBe(2);
    const detached = result?.words?.find((w) => w.text === "er");
    expect(detached).toBeDefined();
    expect(detached?.syllableGroupId).toBeUndefined();
    expect(detached?.begin).toBeCloseTo(6.3, 5);
  });

  it("clears line.begin/end when bg → main populates main from empty", () => {
    const line: LyricLine = {
      id: "l1",
      text: "solo",
      agentId: "v1",
      begin: 5,
      end: 10,
      backgroundText: "solo",
      backgroundWords: [{ text: "solo", begin: 6, end: 7 }],
    };

    const result = applyShiftDragCrossTrack(line, "bg", 0, 0, DURATION);

    expect(result?.words?.length).toBe(1);
    expect(result?.begin).toBeUndefined();
    expect(result?.end).toBeUndefined();
  });

  it("clears bg fields when bg → main empties the bg array", () => {
    const line: LyricLine = {
      id: "l1",
      text: "main",
      agentId: "v1",
      words: [{ text: "main", begin: 0, end: 0.5 }],
      backgroundText: "solo",
      backgroundWords: [{ text: "solo", begin: 1, end: 1.5, syllableGroupId: "g" }],
    };

    const result = applyShiftDragCrossTrack(line, "bg", 0, 2, DURATION);

    expect(result?.backgroundWords).toBeUndefined();
    expect(result?.backgroundText).toBeUndefined();
    expect(result?.words?.length).toBe(2);
  });

  it("clears line.begin/end when main → bg empties the main array", () => {
    const line: LyricLine = {
      id: "l1",
      text: "solo",
      agentId: "v1",
      begin: 5,
      end: 6,
      words: [{ text: "solo", begin: 5, end: 6, syllableGroupId: "g" }],
    };

    const result = applyShiftDragCrossTrack(line, "word", 0, 2, DURATION);

    expect(result?.words).toEqual([]);
    expect(result?.begin).toBeUndefined();
    expect(result?.end).toBeUndefined();
    expect(result?.backgroundWords?.length).toBe(1);
    expect(result?.backgroundWords?.[0].syllableGroupId).toBeUndefined();
  });

  it("returns null when wordIndex is out of bounds", () => {
    const line: LyricLine = {
      id: "l1",
      text: "x",
      agentId: "v1",
      words: [{ text: "x", begin: 0, end: 1 }],
    };

    expect(applyShiftDragCrossTrack(line, "word", 5, 1, DURATION)).toBeNull();
    expect(applyShiftDragCrossTrack(line, "bg", 0, 1, DURATION)).toBeNull();
  });

  it("works for a standalone (non-group) word: just moves it, no group state to strip", () => {
    const line: LyricLine = {
      id: "l1",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello ", begin: 0, end: 0.3 },
        { text: "world", begin: 0.3, end: 0.6 },
      ],
    };

    const result = applyShiftDragCrossTrack(line, "word", 0, 5, DURATION);

    expect(result?.words?.length).toBe(1);
    expect(result?.words?.[0].text).toBe("world");
    expect(result?.backgroundWords?.length).toBe(1);
    expect(result?.backgroundWords?.[0].text).toBe("hello");
    expect(result?.backgroundWords?.[0].syllableGroupId).toBeUndefined();
  });
});
