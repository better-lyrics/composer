import { describe, expect, it } from "vitest";
import { shiftLineTiming, shiftWords } from "@/domain/line/shift";
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
