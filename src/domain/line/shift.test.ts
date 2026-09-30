import { describe, expect, it } from "vitest";
import { clampShiftDelta, shiftLineTiming, shiftWords } from "@/domain/line/shift";
import { createLine } from "@/test/factories";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });

describe("shiftWords", () => {
  it("moves every word by the delta", () => {
    expect(shiftWords([word("a ", 1, 2), word("b", 2, 3)], 5)).toEqual([word("a ", 6, 7), word("b", 7, 8)]);
  });
  it("keeps other word fields such as syllableGroupId and explicit", () => {
    const shifted = shiftWords([{ ...word("a", 1, 2), syllableGroupId: "g1", explicit: true }], 1);
    expect(shifted[0]).toMatchObject({ syllableGroupId: "g1", explicit: true, begin: 2, end: 3 });
  });
  it("clamps at zero instead of going negative", () => {
    expect(shiftWords([word("a", 1, 2)], -5)).toEqual([word("a", 0, 0)]);
  });
  it("invariant: does not mutate the input", () => {
    const input = [word("a", 1, 2)];
    shiftWords(input, 1);
    expect(input).toEqual([word("a", 1, 2)]);
  });
  it("edge: an empty array stays empty", () => {
    expect(shiftWords([], 3)).toEqual([]);
  });
});

describe("clampShiftDelta", () => {
  it("stops the earliest main begin at zero", () => {
    const lines = [createLine({ text: "a", begin: 0.5, end: 2.5 }), createLine({ text: "b", begin: 3, end: 4 })];
    expect(clampShiftDelta(lines, -2)).toBe(-0.5);
  });

  it("leaves a delta that stays at or above zero alone", () => {
    expect(clampShiftDelta([createLine({ text: "a", begin: 5, end: 6 })], -2)).toBe(-2);
    expect(clampShiftDelta([createLine({ text: "a", begin: 5, end: 6 })], 3)).toBe(3);
  });

  describe("edge cases", () => {
    it("does not clamp when no line has main timing", () => {
      expect(clampShiftDelta([createLine({ text: "a" })], -4)).toBe(-4);
      expect(clampShiftDelta([], -4)).toBe(-4);
    });
  });
});

describe("shiftLineTiming", () => {
  it("shifts a word-synced line and its background words by the same delta (P3)", () => {
    const line = createLine({
      text: "a b",
      words: [word("a ", 20, 21), word("b", 21, 22)],
      backgroundText: "oh",
      backgroundWords: [word("oh", 20.5, 21.5)],
    });
    expect(shiftLineTiming(line, -17)).toEqual({
      words: [word("a ", 3, 4), word("b", 4, 5)],
      backgroundWords: [word("oh", 3.5, 4.5)],
    });
  });
  it("shifts a line-synced line", () => {
    expect(shiftLineTiming(createLine({ text: "a", begin: 26, end: 28 }), -21)).toEqual({ begin: 5, end: 7 });
  });
  it("edge: a line-synced line nudged past zero keeps its duration", () => {
    expect(shiftLineTiming(createLine({ text: "a", begin: 0.5, end: 2 }), -1)).toEqual({ begin: 0, end: 1.5 });
  });
  it("edge: a word-synced line nudged past zero keeps every word length and gap", () => {
    const line = createLine({ text: "a b", words: [word("a ", 1, 2), word("b", 3, 4)] });
    expect(shiftLineTiming(line, -5)).toEqual({ words: [word("a ", 0, 1), word("b", 2, 3)] });
  });
  it("edge: background words move by the clamped main delta", () => {
    const line = createLine({
      text: "a",
      begin: 1,
      end: 2,
      backgroundText: "oh",
      backgroundWords: [word("oh", 1.5, 2.5)],
    });
    expect(shiftLineTiming(line, -3)).toEqual({ begin: 0, end: 1, backgroundWords: [word("oh", 0.5, 1.5)] });
  });
  it("edge: an untimed line with no background returns no fields", () => {
    expect(shiftLineTiming(createLine({ text: "a" }), 3)).toEqual({});
  });
  it("edge: an untimed line with background words shifts only the background", () => {
    const line = createLine({ text: "a", backgroundText: "oh", backgroundWords: [word("oh", 1, 2)] });
    expect(shiftLineTiming(line, 1)).toEqual({ backgroundWords: [word("oh", 2, 3)] });
  });
});

describe("time range", () => {
  it("stops the earliest main begin at the range start", () => {
    const lines = [createLine({ text: "a", begin: 10, end: 12 })];
    expect(clampShiftDelta(lines, -5, { min: 7, max: 60 })).toBe(-3);
  });

  it("stops the latest main end at the range end", () => {
    const lines = [createLine({ text: "a", begin: 10, end: 12 }), createLine({ text: "b", begin: 13, end: 15 })];
    expect(clampShiftDelta(lines, 10, { min: 0, max: 20 })).toBe(5);
  });

  it("moves a shared line only as far as the range allows, keeping its length", () => {
    const line = createLine({ text: "a b", words: [word("a ", 10, 11), word("b", 11, 12)] });
    expect(shiftLineTiming(line, -5, { min: 8, max: 60 })).toEqual({ words: [word("a ", 8, 9), word("b", 9, 10)] });
    expect(shiftLineTiming(line, 50, { min: 0, max: 14 })).toEqual({ words: [word("a ", 12, 13), word("b", 13, 14)] });
  });

  describe("edge cases", () => {
    it("keeps a delta that stays inside the range", () => {
      expect(clampShiftDelta([createLine({ text: "a", begin: 10, end: 12 })], 2, { min: 5, max: 20 })).toBe(2);
    });

    it("prefers the start when the lines are longer than the range", () => {
      expect(clampShiftDelta([createLine({ text: "a", begin: 10, end: 20 })], 3, { min: 9, max: 15 })).toBe(-1);
    });
  });

  describe("background words", () => {
    const withBackground = (main: { begin: number; end: number }, background: { begin: number; end: number }) =>
      createLine({
        text: "a",
        begin: main.begin,
        end: main.end,
        backgroundText: "oh",
        backgroundWords: [word("oh", background.begin, background.end)],
      });

    it("stops a background word that starts before the main words at the range start", () => {
      const line = withBackground({ begin: 10, end: 12 }, { begin: 8, end: 9 });
      expect(clampShiftDelta([line], -5, { min: 6, max: 60 })).toBe(-2);
      expect(shiftLineTiming(line, -5, { min: 6, max: 60 })).toEqual({
        begin: 8,
        end: 10,
        backgroundWords: [word("oh", 6, 7)],
      });
    });

    it("stops a background word that ends after the main words at the range end", () => {
      const line = withBackground({ begin: 10, end: 12 }, { begin: 11, end: 14 });
      expect(clampShiftDelta([line], 10, { min: 0, max: 20 })).toBe(6);
      expect(shiftLineTiming(line, 10, { min: 0, max: 20 })).toEqual({
        begin: 16,
        end: 18,
        backgroundWords: [word("oh", 17, 20)],
      });
    });

    it("measures the whole set of lines, main and background", () => {
      const lines = [
        withBackground({ begin: 10, end: 12 }, { begin: 9, end: 10 }),
        createLine({ text: "b", begin: 13, end: 15 }),
      ];
      expect(clampShiftDelta(lines, -20)).toBe(-9);
    });

    it("stops the background of an untimed line at the range edges", () => {
      const line = createLine({ text: "a", backgroundText: "oh", backgroundWords: [word("oh", 10, 12)] });
      expect(clampShiftDelta([line], 20, { min: 0, max: 15 })).toBe(3);
      expect(shiftLineTiming(line, -20)).toEqual({ backgroundWords: [word("oh", 0, 2)] });
    });

    describe("invariants", () => {
      it("keeps the background at the same place relative to the main words", () => {
        const line = withBackground({ begin: 10, end: 12 }, { begin: 8, end: 13 });
        const shifted = shiftLineTiming(line, -50, { min: 0, max: 60 });
        expect(shifted).toEqual({ begin: 2, end: 4, backgroundWords: [word("oh", 0, 5)] });
      });
    });
  });

  describe("regressions", () => {
    it("measures only the main words for a line whose background stays inside them", () => {
      const line = createLine({
        text: "a",
        begin: 10,
        end: 12,
        backgroundText: "oh",
        backgroundWords: [word("oh", 10.5, 11.5)],
      });
      expect(clampShiftDelta([line], -20, { min: 4, max: 60 })).toBe(-6);
      expect(clampShiftDelta([line], 20, { min: 0, max: 20 })).toBe(8);
    });

    it("has no end limit by default, so a line outside a group moves as before", () => {
      expect(clampShiftDelta([createLine({ text: "a", begin: 10, end: 12 })], 1e6)).toBe(1e6);
      expect(shiftLineTiming(createLine({ text: "a", begin: 10, end: 12 }), 1e6)).toEqual({
        begin: 1e6 + 10,
        end: 1e6 + 12,
      });
    });
  });
});
