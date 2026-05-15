/**
 * @vitest-environment node
 */
import type { LyricLine } from "@/stores/project";
import { describe, expect, it } from "vitest";
import { applyShiftDragCrossTrack } from "./apply-shift-drag-cross-track";

const DURATION = 30;

describe("applyShiftDragCrossTrack", () => {
  it("detaches a single syllable from a 3-syllable group when moving main → bg", () => {
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
    expect(result?.words?.[0].syllableGroupId).toBe("g");
    expect(result?.words?.[1].syllableGroupId).toBe("g");

    expect(result?.backgroundWords?.length).toBe(1);
    expect(result?.backgroundWords?.[0].text).toBe("er");
    expect(result?.backgroundWords?.[0].syllableGroupId).toBeUndefined();
    expect(result?.backgroundWords?.[0].begin).toBeCloseTo(5.3, 5);
  });

  it("absorbs the dragged syllable's timing into the left neighbor", () => {
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

    expect(result?.words?.[0].end).toBeCloseTo(0.6, 5);
    expect(result?.words?.[1].begin).toBeCloseTo(0.6, 5);
    expect(result?.words?.[1].end).toBeCloseTo(0.9, 5);
  });

  it("detaches a syllable when moving bg → main", () => {
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
    expect(result?.backgroundWords?.[1].text).toBe("y");

    expect(result?.words?.length).toBe(2);
    const detached = result?.words?.find((w) => w.text === "er");
    expect(detached).toBeDefined();
    expect(detached?.syllableGroupId).toBeUndefined();
    expect(detached?.begin).toBeCloseTo(6.3, 5);
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
