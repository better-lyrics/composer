import { describe, expect, it } from "vitest";
import { liveAddresses, resolveAddresses } from "@/domain/selection/resolve";
import { createLine } from "@/test/factories";

const afterSplit = createLine({
  id: "a",
  text: "e|ver seen",
  words: [
    { id: "y1", text: "e", sep: "", begin: 1, end: 1.5 },
    { id: "y9", text: "ver", sep: " ", begin: 1.5, end: 2 },
    { id: "y2", text: "seen", begin: 2, end: 3 },
  ],
});
const kept = { lineId: "a", type: "word" as const, syllableId: "y2" };
const gone = { lineId: "a", type: "word" as const, syllableId: "gone" };

describe("resolveAddresses", () => {
  it("follows a word through a split before it and drops a word that is gone", () => {
    expect(resolveAddresses([createLine({ id: "new", text: "fresh" }), afterSplit], [kept, gone])).toEqual([
      { ...kept, lineIndex: 1, wordIndex: 2 },
    ]);
  });

  it("names the one word of a line-synced row", () => {
    const lineSynced = createLine({ id: "c", text: "Whole line", begin: 6, end: 8 });
    expect(resolveAddresses([lineSynced], [{ lineId: "c", type: "word", syllableId: "c:line" }])).toEqual([
      { lineId: "c", type: "word", syllableId: "c:line", lineIndex: 0, wordIndex: 0 },
    ]);
  });
});

describe("liveAddresses", () => {
  it("keeps the same array while every word exists, and drops the ones that are gone", () => {
    const addresses = [kept];
    expect(liveAddresses([afterSplit], addresses)).toBe(addresses);
    expect(liveAddresses([afterSplit], [kept, gone])).toEqual([kept]);
  });
});
