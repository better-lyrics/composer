import { describe, expect, it } from "vitest";
import { resolveBgGranularity } from "@/domain/line/resolve-bg-granularity";
import type { BackgroundVoice, Voice } from "@/domain/voice/model";
import { isLineSynced, isUntimed, isWordSynced } from "@/domain/voice/predicates";
import type { Bounds } from "@/domain/word/bounds";
import { voiceBounds } from "@/domain/voice/bounds";

// -- Fixtures -----------------------------------------------------------------

const mainWordSynced: Voice = {
  text: "hello world now",
  words: [
    { text: "hello ", begin: 0.0, end: 1.0 },
    { text: "world ", begin: 1.0, end: 2.0 },
    { text: "now", begin: 2.0, end: 3.0 },
  ],
};

const mainLineSynced: Voice = { text: "hello world now", begin: 0.0, end: 3.0 };

const mainUntimed: Voice = { text: "hello world now" };

const FALLBACK: Bounds = { begin: 0.0, end: 4.0 };

function secondHalfOf(b: Bounds): Bounds {
  return { begin: (b.begin + b.end) / 2, end: b.end };
}

// -- Tests --------------------------------------------------------------------

describe("resolveBgGranularity", () => {
  describe("resolution table", () => {
    it("word-synced bg + main word-synced: unchanged", () => {
      const bg: BackgroundVoice = {
        text: "ooh ahh",
        words: [
          { text: "ooh ", begin: 1.0, end: 2.0 },
          { text: "ahh", begin: 2.0, end: 3.0 },
        ],
        source: "extraction",
      };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: FALLBACK });
      expect(isWordSynced(result)).toBe(true);
      expect(result).toEqual(bg);
      expect(result.source).toBe("extraction");
    });

    it("word-synced bg + main line-synced: unchanged", () => {
      const bg: BackgroundVoice = {
        text: "ooh ahh",
        words: [
          { text: "ooh ", begin: 1.0, end: 2.0 },
          { text: "ahh", begin: 2.0, end: 3.0 },
        ],
        source: "manual",
      };
      const result = resolveBgGranularity(mainLineSynced, bg, { fallbackBounds: FALLBACK });
      expect(isWordSynced(result)).toBe(true);
      expect(result).toEqual(bg);
      expect(result.source).toBe("manual");
    });

    it("word-synced bg + main untimed: unchanged", () => {
      const bg: BackgroundVoice = {
        text: "ooh ahh",
        words: [
          { text: "ooh ", begin: 1.0, end: 2.0 },
          { text: "ahh", begin: 2.0, end: 3.0 },
        ],
        source: "extraction",
      };
      const result = resolveBgGranularity(mainUntimed, bg, { fallbackBounds: FALLBACK });
      expect(isWordSynced(result)).toBe(true);
      expect(result).toEqual(bg);
    });

    it("line-synced bg + main word-synced: distributes over the bg's OWN bounds", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", begin: 1.5, end: 3.5, source: "extraction" };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: FALLBACK });
      expect(isWordSynced(result)).toBe(true);
      const bounds = voiceBounds(result);
      expect(bounds).not.toBeNull();
      expect(bounds?.begin).toBe(1.5);
      expect(bounds?.end).toBe(3.5);
      expect(result.text).toBe("ooh ahh");
      expect(result.source).toBe("extraction");
    });

    it("line-synced bg + main line-synced: unchanged (stays line-synced)", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", begin: 1.5, end: 3.5, source: "manual" };
      const result = resolveBgGranularity(mainLineSynced, bg, { fallbackBounds: FALLBACK });
      expect(isLineSynced(result)).toBe(true);
      expect(result).toEqual(bg);
    });

    it("line-synced bg + main untimed: unchanged (stays line-synced)", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", begin: 1.5, end: 3.5, source: "extraction" };
      const result = resolveBgGranularity(mainUntimed, bg, { fallbackBounds: FALLBACK });
      expect(isLineSynced(result)).toBe(true);
      expect(result).toEqual(bg);
    });

    it("untimed bg + main word-synced: word-synced over the fallback second half", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", source: "extraction" };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: FALLBACK });
      expect(isWordSynced(result)).toBe(true);
      const expected = secondHalfOf(FALLBACK);
      const bounds = voiceBounds(result);
      expect(bounds?.begin).toBe(expected.begin);
      expect(bounds?.end).toBe(expected.end);
      expect(result.text).toBe("ooh ahh");
      expect(result.source).toBe("extraction");
    });

    it("untimed bg + main line-synced: line-synced over the fallback second half", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", source: "manual" };
      const result = resolveBgGranularity(mainLineSynced, bg, { fallbackBounds: FALLBACK });
      expect(isLineSynced(result)).toBe(true);
      const expected = secondHalfOf(FALLBACK);
      if (!isLineSynced(result)) throw new Error("expected line-synced result");
      expect(result.begin).toBe(expected.begin);
      expect(result.end).toBe(expected.end);
      expect(result.text).toBe("ooh ahh");
      expect(result.source).toBe("manual");
    });

    it("untimed bg + main untimed: unchanged (stays untimed)", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", source: "extraction" };
      const result = resolveBgGranularity(mainUntimed, bg, { fallbackBounds: FALLBACK });
      expect(isUntimed(result)).toBe(true);
      expect(result).toEqual(bg);
    });
  });

  describe("guards", () => {
    it("never re-distributes a word-synced bg, even when main is word-synced (pinned)", () => {
      const bg: BackgroundVoice = {
        text: "ooh ahh yeah",
        words: [
          { text: "ooh ", begin: 5.0, end: 6.0 },
          { text: "ahh ", begin: 6.0, end: 7.0 },
          { text: "yeah", begin: 7.0, end: 8.0 },
        ],
        source: "extraction",
      };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: FALLBACK });
      if (!isWordSynced(result)) throw new Error("expected word-synced result");
      expect(result.words).toEqual(bg.words);
      expect(voiceBounds(result)).toEqual({ begin: 5.0, end: 8.0 });
    });
  });

  describe("edge cases", () => {
    it("does not fabricate words from empty bg text + main word-synced (stays untimed)", () => {
      const bg: BackgroundVoice = { text: "", source: "extraction" };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: FALLBACK });
      expect(isUntimed(result)).toBe(true);
      expect(isWordSynced(result)).toBe(false);
      expect("words" in result ? result.words : []).toEqual([]);
    });

    it("does not fabricate a line-synced voice from empty bg text + main line-synced (stays untimed)", () => {
      const bg: BackgroundVoice = { text: "", source: "manual" };
      const result = resolveBgGranularity(mainLineSynced, bg, { fallbackBounds: FALLBACK });
      expect(isUntimed(result)).toBe(true);
      expect(result).toEqual(bg);
    });

    it("returns the untimed bg unchanged when fallbackBounds is null and main is word-synced", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", source: "extraction" };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: null });
      expect(isUntimed(result)).toBe(true);
      expect(result).toEqual(bg);
    });

    it("returns the untimed bg unchanged when fallbackBounds is null and main is line-synced", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", source: "manual" };
      const result = resolveBgGranularity(mainLineSynced, bg, { fallbackBounds: null });
      expect(isUntimed(result)).toBe(true);
      expect(result).toEqual(bg);
    });

    it("treats an empty-words bg as untimed and falls back to fallback bounds (not pinned)", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", words: [], source: "extraction" };
      expect(voiceBounds(bg)).toBeNull();
      expect(isUntimed(bg)).toBe(true);
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: FALLBACK });
      expect(isWordSynced(result)).toBe(true);
      const bounds = voiceBounds(result);
      expect(bounds?.begin).toBe(2.0);
      expect(bounds?.end).toBe(4.0);
      expect(result.source).toBe("extraction");
    });

    it("returns an empty-words bg unchanged when no fallback bounds are available (defensive)", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", words: [], source: "extraction" };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: null });
      expect(result).toEqual(bg);
    });

    it("handles a single-word untimed bg over the fallback second half", () => {
      const bg: BackgroundVoice = { text: "ooh", source: "manual" };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: FALLBACK });
      expect(isWordSynced(result)).toBe(true);
      const bounds = voiceBounds(result);
      expect(bounds?.begin).toBe(2.0);
      expect(bounds?.end).toBe(4.0);
    });

    it("handles begin: 0 fallback bounds without treating the second half as falsy", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", source: "manual" };
      const result = resolveBgGranularity(mainLineSynced, bg, { fallbackBounds: { begin: 0, end: 2 } });
      if (!isLineSynced(result)) throw new Error("expected line-synced result");
      expect(result.begin).toBe(1);
      expect(result.end).toBe(2);
    });
  });

  describe("invariants", () => {
    const cells: Array<{ name: string; main: Voice; bg: BackgroundVoice; fallbackBounds: Bounds | null }> = [
      {
        name: "word bg + main word",
        main: mainWordSynced,
        bg: { text: "ooh ahh", words: [{ text: "ooh ahh", begin: 1, end: 2 }], source: "extraction" },
        fallbackBounds: FALLBACK,
      },
      {
        name: "line bg + main word",
        main: mainWordSynced,
        bg: { text: "ooh ahh", begin: 1.5, end: 3.5, source: "manual" },
        fallbackBounds: FALLBACK,
      },
      {
        name: "line bg + main line",
        main: mainLineSynced,
        bg: { text: "ooh ahh", begin: 1.5, end: 3.5, source: "extraction" },
        fallbackBounds: FALLBACK,
      },
      {
        name: "untimed bg + main word",
        main: mainWordSynced,
        bg: { text: "ooh ahh", source: "manual" },
        fallbackBounds: FALLBACK,
      },
      {
        name: "untimed bg + main line",
        main: mainLineSynced,
        bg: { text: "ooh ahh", source: "extraction" },
        fallbackBounds: FALLBACK,
      },
      {
        name: "untimed bg + main untimed",
        main: mainUntimed,
        bg: { text: "ooh ahh", source: "manual" },
        fallbackBounds: FALLBACK,
      },
    ];

    it("is idempotent across every cell (running twice equals once)", () => {
      for (const { main, bg, fallbackBounds } of cells) {
        const once = resolveBgGranularity(main, bg, { fallbackBounds });
        const twice = resolveBgGranularity(main, once, { fallbackBounds });
        expect(twice).toEqual(once);
      }
    });

    it("preserves source extraction across every transformation", () => {
      for (const { main, bg, fallbackBounds } of cells) {
        const withSource: BackgroundVoice = { ...bg, source: "extraction" };
        const result = resolveBgGranularity(main, withSource, { fallbackBounds });
        expect(result.source).toBe("extraction");
      }
    });

    it("preserves source manual across every transformation", () => {
      for (const { main, bg, fallbackBounds } of cells) {
        const withSource: BackgroundVoice = { ...bg, source: "manual" };
        const result = resolveBgGranularity(main, withSource, { fallbackBounds });
        expect(result.source).toBe("manual");
      }
    });

    it("preserves a missing source (does not stamp one)", () => {
      const bg: BackgroundVoice = { text: "ooh ahh", begin: 1.5, end: 3.5 };
      const result = resolveBgGranularity(mainWordSynced, bg, { fallbackBounds: FALLBACK });
      expect("source" in result).toBe(false);
    });

    it("does not mutate the input bg (purity) across every cell", () => {
      for (const { main, bg, fallbackBounds } of cells) {
        const snapshot = structuredClone(bg);
        resolveBgGranularity(main, bg, { fallbackBounds });
        expect(bg).toEqual(snapshot);
      }
    });
  });
});
