import { describe, expect, it } from "vitest";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { reconcileLine, type LooseLine, type LyricLine } from "@/domain/line/model";
import { trackField, trackWords } from "@/domain/line/tracks";

function line(extras: Partial<LooseLine> = {}): LyricLine {
  return reconcileLine({ id: "l1", text: "Hello world", agentId: "v1", ...extras });
}

const mainWords = [
  { text: "Hello ", begin: 0, end: 1 },
  { text: "world", begin: 1, end: 2 },
];
const bgWords = [{ text: "ooh", begin: 1.2, end: 1.8 }];

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
      expect(trackWords(effective, "word")).toEqual([{ text: "Hello world", begin: 3, end: 7 }]);
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
