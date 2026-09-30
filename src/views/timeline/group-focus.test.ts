import { createGroup, createLine, createWord } from "@/test/factories";
import {
  FOCUS_SCROLL_MARGIN_PX,
  adjacentHeardInstance,
  canHearInstance,
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

describe("heard instances", () => {
  const group = createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [3] });
  const unplaced = createLine({ id: "u", text: "go now", groupId: "g1", instanceIdx: 2, templateLineIdx: 0 });
  const song = [
    chorusLine("a", 0, 10),
    verse,
    chorusLine("b", 1, 40),
    unplaced,
    chorusLine("own", 3, 70),
    chorusLine("c", 4, 90),
  ];

  describe("canHearInstance", () => {
    it("hears a placed shared instance", () => {
      expect(canHearInstance(song, group, 1)).toBe(true);
    });

    it("does not hear an own-timing instance", () => {
      expect(canHearInstance(song, group, 3)).toBe(false);
    });

    it("does not hear a shared instance that is not placed", () => {
      expect(canHearInstance(song, group, 2)).toBe(false);
    });

    describe("edge cases", () => {
      it("does not hear any instance of a group that does not share timing", () => {
        expect(canHearInstance(song, createGroup({ id: "g1" }), 0)).toBe(false);
      });

      it("does not hear an instance that has no lines", () => {
        expect(canHearInstance(song, group, 9)).toBe(false);
      });
    });
  });

  describe("adjacentHeardInstance", () => {
    it("steps to the next heard instance, past the ones that cannot be heard", () => {
      expect(adjacentHeardInstance(song, group, 1, 1)).toBe(4);
    });

    it("steps to the previous heard instance", () => {
      expect(adjacentHeardInstance(song, group, 4, -1)).toBe(1);
    });

    it("wraps around at both ends", () => {
      expect(adjacentHeardInstance(song, group, 4, 1)).toBe(0);
      expect(adjacentHeardInstance(song, group, 0, -1)).toBe(4);
    });

    describe("edge cases", () => {
      it("returns null from an own-timing instance", () => {
        expect(adjacentHeardInstance(song, group, 3, 1)).toBeNull();
      });

      it("returns null when only one instance can be heard", () => {
        expect(adjacentHeardInstance([chorusLine("a", 0, 10), unplaced], group, 0, 1)).toBeNull();
      });
    });

    describe("invariants", () => {
      it("only ever returns an instance that can be heard", () => {
        for (const from of [0, 1, 4]) {
          for (const direction of [1, -1] as const) {
            const next = adjacentHeardInstance(song, group, from, direction);
            expect(next).not.toBeNull();
            expect(canHearInstance(song, group, next ?? -1)).toBe(true);
          }
        }
      });
    });
  });
});
