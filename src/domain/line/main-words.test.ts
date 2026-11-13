import { describe, expect, it } from "vitest";
import { mainWordEditFields } from "@/domain/line/main-words";
import { lineText, syllablesText } from "@/domain/line/text";
import { roleWords } from "@/domain/line/track";
import type { WordTiming } from "@/domain/word/timing";
import { createLine } from "@/test/factories";
import { updatedLine } from "@/test/field-updates";
import { getSplitCharacter } from "@/utils/split-character";

const line = createLine({ id: "l1", text: "old words here" });

describe("mainWordEditFields", () => {
  describe("happy paths", () => {
    it("writes the words as the whole main track", () => {
      const words: WordTiming[] = [
        { id: "w8", text: "hi", sep: " ", begin: 0, end: 0.5, joinsNext: false },
        { id: "w9", text: "there", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ];
      const fields = mainWordEditFields(line, words);
      expect(roleWords(updatedLine(fields), "main")).toEqual(words);
      expect(typeof lineText(updatedLine(fields)!)).toBe("string");
    });

    it("reads its text from the words", () => {
      const words: WordTiming[] = [
        { id: "w10", text: "foo", sep: " ", begin: 0, end: 0.5, joinsNext: false },
        { id: "w11", text: "bar", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ];
      expect(lineText(updatedLine(mainWordEditFields(line, words))!)).toBe(syllablesText(words, getSplitCharacter()));
    });
  });

  describe("invariants", () => {
    it("does not mutate the input words array", () => {
      const words: WordTiming[] = [{ id: "w14", text: "z", sep: "", begin: 0, end: 1, joinsNext: false }];
      const before = JSON.stringify(words);
      mainWordEditFields(line, words);
      expect(JSON.stringify(words)).toBe(before);
    });
  });
});
