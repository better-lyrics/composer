import { getEffectiveLines } from "@/domain/line/effective-words";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";
import { trackField, trackWords } from "@/domain/line/tracks";
import { describe, expect, it } from "vitest";

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello world", agentId: "v1", ...extras });
}

const mainWords = [
  { id: "w1", text: "Hello", sep: " ", begin: 0, end: 1, joinsNext: false },
  { id: "w2", text: "world", sep: "", begin: 1, end: 2, joinsNext: false },
];
const bgWords = [{ id: "w3", text: "ooh", sep: "", begin: 1.2, end: 1.8, joinsNext: false }];

describe("trackWords", () => {
  it("returns the main words for the word track", () => {
    const synced = line({ words: mainWords, backgroundText: "ooh", backgroundWords: bgWords });
    expect(trackWords(synced, "word")).toEqual(mainWords);
  });

  it("returns the background words for the bg track", () => {
    const withBg = line({ words: mainWords, backgroundText: "ooh", backgroundWords: bgWords });
    expect(trackWords(withBg, "bg")).toBe(withBg.backgroundWords);
  });

  it("works on an effective line", () => {
    const [effective] = getEffectiveLines([
      line({ words: mainWords, backgroundText: "ooh", backgroundWords: bgWords }),
    ]);
    expect(trackWords(effective, "word")).toBe(effective.words);
    expect(trackWords(effective, "bg")).toBe(effective.backgroundWords);
  });

  describe("edge cases", () => {
    it("returns undefined for a missing main track", () => {
      expect(trackWords(line(), "word")).toBeUndefined();
    });

    it("returns undefined for a missing background track", () => {
      expect(trackWords(line({ words: mainWords }), "bg")).toBeUndefined();
    });

    it("does not synthesize a word for a raw line-synced row", () => {
      expect(trackWords(line({ begin: 3, end: 7 }), "word")).toBeUndefined();
    });

    it("reads the synthesized word of an effective line-synced row", () => {
      const [effective] = getEffectiveLines([line({ begin: 3, end: 7 })]);
      expect(trackWords(effective, "word")).toEqual([
        { text: "Hello world", sep: "", begin: 3, end: 7, joinsNext: false },
      ]);
    });
  });

  describe("invariants", () => {
    it("returns the stored array by reference, never a copy", () => {
      const synced = line({ words: mainWords });
      expect(trackWords(synced, "word")).toBe(synced.words);
    });
  });
});

describe("trackField", () => {
  it("names the line field that holds each track", () => {
    expect(trackField("word")).toBe("words");
    expect(trackField("bg")).toBe("backgroundWords");
  });

  describe("invariants", () => {
    it("reads the same words as trackWords for both tracks", () => {
      const synced = line({ words: mainWords, backgroundText: "ooh", backgroundWords: bgWords });
      expect(synced[trackField("word")]).toBe(trackWords(synced, "word"));
      expect(synced[trackField("bg")]).toBe(trackWords(synced, "bg"));
    });
  });
});
