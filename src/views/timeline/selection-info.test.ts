import { describe, expect, it } from "vitest";
import { getEffectiveLines } from "@/domain/line/effective-words";
import type { WordSelection } from "@/domain/selection/model";
import { createGroup, createLine, createWord } from "@/test/factories";
import {
  multiSelectionSummary,
  selectedWordTiming,
  selectionCountLabel,
  selectionGroupHighlight,
} from "@/views/timeline/selection-info";

// -- Fixtures -----------------------------------------------------------------

const chorus = createGroup({ id: "g1", label: "Chorus", color: "#ff0000" });

function linkedLine(id: string, instanceIdx: number) {
  return createLine({
    id,
    text: "la la",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [createWord({ text: "la ", begin: instanceIdx * 10, end: instanceIdx * 10 + 1 })],
  });
}

function pick(lineId: string, lineIndex: number, type: WordSelection["type"] = "word"): WordSelection {
  return { lineId, lineIndex, wordIndex: 0, type };
}

// -- Tests --------------------------------------------------------------------

describe("selectionGroupHighlight", () => {
  const lines = [linkedLine("a", 0), linkedLine("b", 1), linkedLine("c", 2)];

  it("labels one instance with its ordinal out of every instance", () => {
    expect(selectionGroupHighlight([pick("b", 1)], lines, [chorus])).toEqual({
      accentColor: "#ff0000",
      label: "Chorus · 2 of 3",
    });
  });

  it("counts instances when the selection spans several", () => {
    expect(selectionGroupHighlight([pick("a", 0), pick("c", 2)], lines, [chorus])?.label).toBe("Chorus · 2 instances");
  });

  describe("edge cases", () => {
    it("is null with nothing selected", () => {
      expect(selectionGroupHighlight([], lines, [chorus])).toBeNull();
    });

    it("is null when any selected line is not linked", () => {
      const withLoose = [...lines, createLine({ id: "x", text: "solo" })];
      expect(selectionGroupHighlight([pick("a", 0), pick("x", 3)], withLoose, [chorus])).toBeNull();
    });

    it("is null when the group no longer exists", () => {
      expect(selectionGroupHighlight([pick("a", 0)], lines, [])).toBeNull();
    });
  });
});

describe("selectedWordTiming", () => {
  const line = createLine({
    id: "l1",
    text: "hi",
    words: [createWord({ text: "hi", begin: 1, end: 2 })],
    backgroundText: "oh",
    backgroundWords: [createWord({ text: "oh", begin: 1.5, end: 2.5 })],
  });

  it("reads a main word", () => {
    expect(selectedWordTiming(pick("l1", 0), [line])).toEqual({ text: "hi", begin: 1, end: 2 });
  });

  it("reads a background word", () => {
    expect(selectedWordTiming(pick("l1", 0, "bg"), [line])).toEqual({ text: "oh", begin: 1.5, end: 2.5 });
  });

  describe("edge cases", () => {
    it("is null for a missing line or word", () => {
      expect(selectedWordTiming(pick("l1", 4), [line])).toBeNull();
      expect(selectedWordTiming({ ...pick("l1", 0), wordIndex: 9 }, [line])).toBeNull();
    });
  });
});

describe("multiSelectionSummary", () => {
  const wordLine = createLine({
    id: "w",
    text: "a b",
    words: [createWord({ text: "a ", begin: 1, end: 2 }), createWord({ text: "b", begin: 2, end: 3 })],
  });
  const syncedRow = createLine({ id: "s", text: "row", begin: 5, end: 7 });

  it("spans every selected word and counts line-synced rows as lines", () => {
    const selection = [pick("w", 0), { ...pick("w", 0), wordIndex: 1 }, pick("s", 1)];
    const raw = [wordLine, syncedRow];
    expect(multiSelectionSummary(selection, getEffectiveLines(raw), raw)).toEqual({
      wordCount: 2,
      lineCount: 1,
      begin: 1,
      end: 7,
    });
  });

  describe("edge cases", () => {
    it("is null for a single selection", () => {
      expect(multiSelectionSummary([pick("w", 0)], [wordLine], [wordLine])).toBeNull();
    });
  });
});

describe("selectionCountLabel", () => {
  it("names words and lines together", () => {
    expect(selectionCountLabel(2, 1)).toBe("2 words, 1 line selected");
  });

  it("names only lines or only words", () => {
    expect(selectionCountLabel(0, 3)).toBe("3 lines selected");
    expect(selectionCountLabel(1, 0)).toBe("1 word selected");
  });
});
