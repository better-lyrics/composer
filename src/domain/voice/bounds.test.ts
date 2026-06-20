import { describe, expect, it } from "vitest";
import type { Voice } from "@/domain/voice/model";
import { voiceBounds } from "@/domain/voice/bounds";

// -- Tests --------------------------------------------------------------------

describe("voiceBounds", () => {
  describe("happy paths", () => {
    it("returns first.begin and last.end for a multi-word voice", () => {
      const voice: Voice = {
        text: "hello world now",
        words: [
          { text: "hello", begin: 0.5, end: 1.0 },
          { text: "world", begin: 1.0, end: 1.75 },
          { text: "now", begin: 1.75, end: 2.5 },
        ],
      };
      expect(voiceBounds(voice)).toEqual({ begin: 0.5, end: 2.5 });
    });

    it("returns the single word's begin/end for a single-word voice", () => {
      const voice: Voice = {
        text: "ooh",
        words: [{ text: "ooh", begin: 1.2, end: 3.4 }],
      };
      expect(voiceBounds(voice)).toEqual({ begin: 1.2, end: 3.4 });
    });

    it("returns its own begin/end for a line-synced voice", () => {
      const voice: Voice = { text: "ooh", begin: 1.5, end: 3.25 };
      expect(voiceBounds(voice)).toEqual({ begin: 1.5, end: 3.25 });
    });

    it("returns null for an untimed voice", () => {
      const voice: Voice = { text: "ooh" };
      expect(voiceBounds(voice)).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles begin: 0 on a line-synced voice without treating it as untimed", () => {
      const voice: Voice = { text: "ooh", begin: 0, end: 1 };
      expect(voiceBounds(voice)).toEqual({ begin: 0, end: 1 });
    });

    it("handles begin: 0 on a word-synced voice", () => {
      const voice: Voice = {
        text: "ooh",
        words: [{ text: "ooh", begin: 0, end: 1 }],
      };
      expect(voiceBounds(voice)).toEqual({ begin: 0, end: 1 });
    });

    it("returns null for a voice with an empty words array", () => {
      const voice: Voice = { text: "", words: [] };
      expect(voiceBounds(voice)).toBeNull();
    });

    it("returns null for an empty-string untimed voice", () => {
      const voice: Voice = { text: "" };
      expect(voiceBounds(voice)).toBeNull();
    });
  });
});
