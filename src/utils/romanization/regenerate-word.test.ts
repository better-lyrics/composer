import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import type { GeneratedRomanization, RomanizationGenerator } from "@/domain/romanization/registry";
import {
  clearGeneratorRegistry,
  registerGeneratorFactory,
  restoreGeneratorRegistry,
  snapshotGeneratorRegistry,
} from "@/domain/romanization/registry";
import { clearGeneratorCacheForTests } from "@/utils/romanization/generate-for-line";
import { regenerateWord } from "@/utils/romanization/regenerate-word";

// -- Helpers ------------------------------------------------------------------

interface RecordedCall {
  text: string;
  wordCount: number | undefined;
  wordTexts: string[] | undefined;
}

function makeRecordingGenerator(
  scheme: string,
  output: GeneratedRomanization,
  sink: RecordedCall[],
): RomanizationGenerator {
  return {
    scheme,
    async generateLine(line: LyricLine): Promise<GeneratedRomanization> {
      sink.push({
        text: line.text,
        wordCount: line.words?.length,
        wordTexts: line.words?.map((w) => w.text),
      });
      return output;
    },
  };
}

let originalSnapshot: ReturnType<typeof snapshotGeneratorRegistry>;

beforeAll(() => {
  originalSnapshot = snapshotGeneratorRegistry();
});

beforeEach(() => {
  clearGeneratorCacheForTests();
  clearGeneratorRegistry();
});

afterEach(() => {
  restoreGeneratorRegistry(originalSnapshot);
});

// -- Tests --------------------------------------------------------------------

describe("regenerateWord", () => {
  describe("input shaping", () => {
    it("calls generateForLine with a single-word slice for the targeted index", async () => {
      const calls: RecordedCall[] = [];
      registerGeneratorFactory("zz-slice", async () =>
        makeRecordingGenerator("zz-slice", { text: "yoru", wordTexts: ["yoru"] }, calls),
      );
      const line: LyricLine = {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
      };
      await regenerateWord(line, 0, "zz-slice");
      expect(calls).toHaveLength(1);
      expect(calls[0].wordCount).toBe(1);
      expect(calls[0].wordTexts).toEqual(["夜"]);
      expect(calls[0].text).toBe("夜");
    });

    it("uses the word at the given index, not always index 0", async () => {
      const calls: RecordedCall[] = [];
      registerGeneratorFactory("zz-slice", async () =>
        makeRecordingGenerator("zz-slice", { text: "dakedo", wordTexts: ["dakedo"] }, calls),
      );
      const line: LyricLine = {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
      };
      await regenerateWord(line, 1, "zz-slice");
      expect(calls[0].wordTexts).toEqual(["だけど"]);
      expect(calls[0].text).toBe("だけど");
    });

    it("strips the split character from the source word before generating", async () => {
      const calls: RecordedCall[] = [];
      registerGeneratorFactory("zz-slice", async () =>
        makeRecordingGenerator("zz-slice", { text: "yorudake", wordTexts: ["yorudake"] }, calls),
      );
      const line: LyricLine = {
        id: "L1",
        text: "夜|だけど",
        agentId: "v1",
        words: [
          { text: "夜|だけ", begin: 0, end: 1 },
          { text: "ど", begin: 1, end: 2 },
        ],
      };
      await regenerateWord(line, 0, "zz-slice");
      expect(calls[0].wordTexts).toEqual(["夜だけ"]);
      expect(calls[0].text).toBe("夜だけ");
    });
  });

  describe("return shape", () => {
    it("returns the first wordTexts entry when the generator returns alignment", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          return { text: "ignored-line-text", wordTexts: ["yoru"] };
        },
      }));
      const line: LyricLine = {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
      };
      const result = await regenerateWord(line, 0, "zz-slice");
      expect(result.romaji).toBe("yoru");
      expect(result.text).toBe("夜");
    });

    it("falls back to the line-level text when the generator returns no wordTexts", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          return { text: "fallback" };
        },
      }));
      const line: LyricLine = {
        id: "L1",
        text: "夜",
        agentId: "v1",
        words: [{ text: "夜", begin: 0, end: 1 }],
      };
      const result = await regenerateWord(line, 0, "zz-slice");
      expect(result.romaji).toBe("fallback");
    });

    it("trims surrounding whitespace from the generator output", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          return { text: "  yoru  ", wordTexts: ["  yoru  "] };
        },
      }));
      const line: LyricLine = {
        id: "L1",
        text: "夜",
        agentId: "v1",
        words: [{ text: "夜", begin: 0, end: 1 }],
      };
      const result = await regenerateWord(line, 0, "zz-slice");
      expect(result.romaji).toBe("yoru");
    });

    it("returns the stripped source word as `text`", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          return { text: "yo", wordTexts: ["yo"] };
        },
      }));
      const line: LyricLine = {
        id: "L1",
        text: "夜|だけ",
        agentId: "v1",
        words: [{ text: "夜|だけ", begin: 0, end: 1 }],
      };
      const result = await regenerateWord(line, 0, "zz-slice");
      expect(result.text).toBe("夜だけ");
    });
  });

  describe("error handling", () => {
    it("throws when `line.words` is absent", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          return { text: "x" };
        },
      }));
      const line: LyricLine = { id: "L1", text: "hello", agentId: "v1" };
      await expect(regenerateWord(line, 0, "zz-slice")).rejects.toThrow(/no word at index 0/);
    });

    it("throws when the word index is out of range", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          return { text: "x" };
        },
      }));
      const line: LyricLine = {
        id: "L1",
        text: "夜",
        agentId: "v1",
        words: [{ text: "夜", begin: 0, end: 1 }],
      };
      await expect(regenerateWord(line, 5, "zz-slice")).rejects.toThrow(/no word at index 5/);
    });

    it("propagates errors from the underlying generator", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          throw new Error("generator-failed");
        },
      }));
      const line: LyricLine = {
        id: "L1",
        text: "夜",
        agentId: "v1",
        words: [{ text: "夜", begin: 0, end: 1 }],
      };
      await expect(regenerateWord(line, 0, "zz-slice")).rejects.toThrow(/generator-failed/);
    });

    it("throws when no generator is registered for the scheme", async () => {
      const line: LyricLine = {
        id: "L1",
        text: "夜",
        agentId: "v1",
        words: [{ text: "夜", begin: 0, end: 1 }],
      };
      await expect(regenerateWord(line, 0, "zz-unregistered")).rejects.toThrow(/zz-unregistered/);
    });
  });

  describe("immutability", () => {
    it("does not mutate the input line", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          return { text: "yoru", wordTexts: ["yoru"] };
        },
      }));
      const line: LyricLine = {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
      };
      const snapshot = JSON.stringify(line);
      await regenerateWord(line, 0, "zz-slice");
      expect(JSON.stringify(line)).toBe(snapshot);
    });

    it("does not mutate the original word entry inside line.words", async () => {
      registerGeneratorFactory("zz-slice", async () => ({
        scheme: "zz-slice",
        async generateLine(): Promise<GeneratedRomanization> {
          return { text: "yoru", wordTexts: ["yoru"] };
        },
      }));
      const originalWord = { text: "夜|だけ", begin: 0, end: 1 };
      const line: LyricLine = {
        id: "L1",
        text: "夜|だけど",
        agentId: "v1",
        words: [originalWord, { text: "ど", begin: 1, end: 2 }],
      };
      await regenerateWord(line, 0, "zz-slice");
      expect(originalWord.text).toBe("夜|だけ");
    });
  });
});
