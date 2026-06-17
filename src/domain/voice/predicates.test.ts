import { describe, expect, it } from "vitest";
import type { Voice } from "@/domain/voice/model";
import { isLineSynced, isUntimed, isWordSynced } from "@/domain/voice/predicates";

// -- Tests --------------------------------------------------------------------

describe("voice predicates", () => {
  describe("happy paths", () => {
    it("classifies an untimed voice exclusively as untimed", () => {
      const voice: Voice = { text: "ooh" };
      expect(isUntimed(voice)).toBe(true);
      expect(isLineSynced(voice)).toBe(false);
      expect(isWordSynced(voice)).toBe(false);
    });

    it("classifies a line-synced voice exclusively as line-synced", () => {
      const voice: Voice = { text: "ooh", begin: 1.5, end: 3.25 };
      expect(isLineSynced(voice)).toBe(true);
      expect(isUntimed(voice)).toBe(false);
      expect(isWordSynced(voice)).toBe(false);
    });

    it("classifies a word-synced voice exclusively as word-synced", () => {
      const voice: Voice = {
        text: "hello world",
        words: [
          { text: "hello", begin: 0.5, end: 1.0 },
          { text: "world", begin: 1.0, end: 1.75 },
        ],
      };
      expect(isWordSynced(voice)).toBe(true);
      expect(isUntimed(voice)).toBe(false);
      expect(isLineSynced(voice)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("treats a voice with an empty words array as untimed, not word-synced", () => {
      const voice: Voice = { text: "", words: [] };
      expect(isWordSynced(voice)).toBe(false);
      expect(isLineSynced(voice)).toBe(false);
      expect(isUntimed(voice)).toBe(true);
    });

    it("treats begin: 0 as line-synced (guards against falsy-begin bug)", () => {
      const voice: Voice = { text: "ooh", begin: 0, end: 1 };
      expect(isLineSynced(voice)).toBe(true);
      expect(isUntimed(voice)).toBe(false);
      expect(isWordSynced(voice)).toBe(false);
    });

    it("treats a single word with begin: 0 as word-synced", () => {
      const voice: Voice = {
        text: "ooh",
        words: [{ text: "ooh", begin: 0, end: 1 }],
      };
      expect(isWordSynced(voice)).toBe(true);
      expect(isLineSynced(voice)).toBe(false);
      expect(isUntimed(voice)).toBe(false);
    });

    it("does not let whitespace text affect classification", () => {
      const untimed: Voice = { text: "   " };
      expect(isUntimed(untimed)).toBe(true);
      expect(isLineSynced(untimed)).toBe(false);
      expect(isWordSynced(untimed)).toBe(false);
    });

    it("does not let unicode text affect classification", () => {
      const voice: Voice = { text: "안녕 🎵", begin: 2, end: 4 };
      expect(isLineSynced(voice)).toBe(true);
      expect(isUntimed(voice)).toBe(false);
      expect(isWordSynced(voice)).toBe(false);
    });

    it("treats an empty-string untimed voice as untimed", () => {
      const voice: Voice = { text: "" };
      expect(isUntimed(voice)).toBe(true);
      expect(isLineSynced(voice)).toBe(false);
      expect(isWordSynced(voice)).toBe(false);
    });
  });

  describe("invariants", () => {
    it("exactly one predicate is true for every voice shape", () => {
      const voices: Voice[] = [
        { text: "ooh" },
        { text: "" },
        { text: "ooh", begin: 0, end: 1 },
        { text: "ooh", begin: 1.5, end: 3.25 },
        { text: "", words: [] },
        { text: "hi", words: [{ text: "hi", begin: 0, end: 1 }] },
      ];
      for (const voice of voices) {
        const trueCount = [isUntimed(voice), isLineSynced(voice), isWordSynced(voice)].filter(Boolean).length;
        expect(trueCount).toBe(1);
      }
    });
  });
});
