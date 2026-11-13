import { describe, expect, it } from "vitest";
import { mainWordEditFields } from "@/domain/line/main-words";
import type { WordTiming } from "@/domain/word/timing";

describe("mainWordEditFields", () => {
  describe("happy paths", () => {
    it("returns a { words, text } pair", () => {
      const words: WordTiming[] = [
        { id: "w8", text: "hi", sep: " ", begin: 0, end: 0.5, joinsNext: false },
        { id: "w9", text: "there", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ];
      const fields = mainWordEditFields(words);
      expect(fields.words).toEqual(words);
      expect(typeof fields.text).toBe("string");
    });

    it("derives text via reconstructLineText", async () => {
      const { reconstructLineText } = await import("@/domain/line/reconstruct-text");
      const { getSplitCharacter } = await import("@/utils/split-character");
      const words: WordTiming[] = [
        { id: "w10", text: "foo", sep: " ", begin: 0, end: 0.5, joinsNext: false },
        { id: "w11", text: "bar", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ];
      expect(mainWordEditFields(words).text).toBe(reconstructLineText(words, getSplitCharacter()));
    });
  });

  describe("invariants", () => {
    it("does not mutate the input words array", () => {
      const words: WordTiming[] = [{ id: "w14", text: "z", sep: "", begin: 0, end: 1, joinsNext: false }];
      const before = JSON.stringify(words);
      mainWordEditFields(words);
      expect(JSON.stringify(words)).toBe(before);
    });
  });
});
