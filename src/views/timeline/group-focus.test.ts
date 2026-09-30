import { createLine, createWord } from "@/test/factories";
import {
  FOCUS_SCROLL_MARGIN_PX,
  clampScrollLeft,
  effectiveFocus,
  focusBounds,
  focusScrollRange,
  isInFocus,
} from "@/views/timeline/group-focus";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const chorusLine = (id: string, instanceIdx: number, begin: number) =>
  createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });

const verse = createLine({ id: "v", text: "verse", words: [createWord({ text: "verse", begin: 5, end: 6 })] });
const lines = [chorusLine("a", 0, 10), verse, chorusLine("b", 1, 40)];

// -- Tests --------------------------------------------------------------------

describe("isInFocus", () => {
  it("keeps every line when nothing is focused", () => {
    expect(lines.every((line) => isInFocus(line, null))).toBe(true);
  });

  it("keeps only the lines of the heard instance", () => {
    const focus = { groupId: "g1", hearInstanceIdx: 1 };

    expect(lines.filter((line) => isInFocus(line, focus)).map((line) => line.id)).toEqual(["b"]);
  });

  describe("edge cases", () => {
    it("keeps nothing for a group that has no lines", () => {
      expect(lines.some((line) => isInFocus(line, { groupId: "gone", hearInstanceIdx: 0 }))).toBe(false);
    });
  });
});

describe("effectiveFocus", () => {
  it("keeps a focus whose instance still has lines", () => {
    const focus = { groupId: "g1", hearInstanceIdx: 1 };

    expect(effectiveFocus(lines, focus)).toBe(focus);
  });

  it("returns null when nothing is focused", () => {
    expect(effectiveFocus(lines, null)).toBeNull();
  });

  describe("edge cases", () => {
    it("returns null for a focus on an instance that has no lines", () => {
      expect(effectiveFocus(lines, { groupId: "g1", hearInstanceIdx: 7 })).toBeNull();
    });

    it("returns null for a focus on a group that is gone", () => {
      expect(effectiveFocus(lines, { groupId: "gone", hearInstanceIdx: 0 })).toBeNull();
    });

    it("returns null for an empty song", () => {
      expect(effectiveFocus([], { groupId: "g1", hearInstanceIdx: 0 })).toBeNull();
    });
  });
});

describe("focusBounds", () => {
  it("returns the span of the heard instance", () => {
    expect(focusBounds(lines, { groupId: "g1", hearInstanceIdx: 1 })).toEqual({ begin: 40, end: 42 });
  });

  describe("edge cases", () => {
    it("returns null for an instance with no lines", () => {
      expect(focusBounds(lines, { groupId: "g1", hearInstanceIdx: 7 })).toBeNull();
    });
  });
});

describe("focusScrollRange", () => {
  it("starts a margin before the instance and ends a margin after it", () => {
    const range = focusScrollRange({ begin: 40, end: 60 }, 50, 400);

    expect(range).toEqual({
      min: 40 * 50 - FOCUS_SCROLL_MARGIN_PX,
      max: 60 * 50 + FOCUS_SCROLL_MARGIN_PX - 400,
    });
  });

  describe("edge cases", () => {
    it("never starts before the song", () => {
      expect(focusScrollRange({ begin: 0, end: 20 }, 50, 400).min).toBe(0);
    });

    it("pins the scroll when the instance is narrower than the view", () => {
      const range = focusScrollRange({ begin: 40, end: 41 }, 50, 800);

      expect(range.max).toBe(range.min);
    });
  });

  describe("invariants", () => {
    it("never returns a max below the min", () => {
      for (const width of [0, 100, 5000]) {
        const range = focusScrollRange({ begin: 3, end: 4 }, 20, width);
        expect(range.max).toBeGreaterThanOrEqual(range.min);
      }
    });
  });
});

describe("clampScrollLeft", () => {
  const range = { min: 100, max: 300 };

  it("keeps a value inside the range", () => {
    expect(clampScrollLeft(200, range)).toBe(200);
  });

  it("moves a value before the range to the start", () => {
    expect(clampScrollLeft(0, range)).toBe(100);
  });

  it("moves a value past the range to the end", () => {
    expect(clampScrollLeft(900, range)).toBe(300);
  });
});
