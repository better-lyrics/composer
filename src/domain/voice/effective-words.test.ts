import { describe, expect, it } from "vitest";
import type { Voice } from "@/domain/voice/model";
import { effectiveVoiceWords } from "@/domain/voice/effective-words";

// -- Tests --------------------------------------------------------------------

describe("effectiveVoiceWords", () => {
  describe("happy paths", () => {
    it("returns one WordTiming for a line-synced voice with its begin/end", () => {
      const voice: Voice = { text: "ooh", begin: 1.5, end: 3.25 };
      expect(effectiveVoiceWords(voice)).toEqual([{ text: "ooh", begin: 1.5, end: 3.25 }]);
    });

    it("strips the split character from a line-synced voice's text", () => {
      const voice: Voice = { text: "be|au|ti|ful", begin: 0.5, end: 2.0 };
      const result = effectiveVoiceWords(voice);
      expect(result).toEqual([{ text: "beautiful", begin: 0.5, end: 2.0 }]);
      expect(result[0].text).not.toContain("|");
    });

    it("returns the words array for a word-synced voice", () => {
      const words = [
        { text: "hello", begin: 0.5, end: 1.0 },
        { text: "world", begin: 1.0, end: 1.75 },
      ];
      const voice: Voice = { text: "hello world", words };
      expect(effectiveVoiceWords(voice)).toEqual(words);
    });

    it("returns an empty array for an untimed voice", () => {
      const voice: Voice = { text: "ooh" };
      expect(effectiveVoiceWords(voice)).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("handles begin: 0 on a line-synced voice", () => {
      const voice: Voice = { text: "ooh", begin: 0, end: 1 };
      expect(effectiveVoiceWords(voice)).toEqual([{ text: "ooh", begin: 0, end: 1 }]);
    });

    it("returns an empty array for an empty-string untimed voice", () => {
      const voice: Voice = { text: "" };
      expect(effectiveVoiceWords(voice)).toEqual([]);
    });

    it("returns an empty array for a voice with an empty words array", () => {
      const voice: Voice = { text: "", words: [] };
      expect(effectiveVoiceWords(voice)).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("returns the same words array reference for a word-synced voice", () => {
      const words = [{ text: "ooh", begin: 0, end: 1 }];
      const voice: Voice = { text: "ooh", words };
      expect(effectiveVoiceWords(voice)).toBe(words);
    });
  });
});
