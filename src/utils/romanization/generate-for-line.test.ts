import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricLine, RomanizationData } from "@/domain/line/model";
import type { GeneratedRomanization, RomanizationGenerator } from "@/domain/romanization/registry";
import {
  clearGeneratorRegistry,
  registerGeneratorFactory,
  restoreGeneratorRegistry,
  snapshotGeneratorRegistry,
} from "@/domain/romanization/registry";
import { clearGeneratorCacheForTests, generateForLine } from "@/utils/romanization/generate-for-line";

// -- Helpers ------------------------------------------------------------------

function reverseText(text: string): string {
  return text.split("").reverse().join("");
}

function makeReverseGenerator(scheme: string): RomanizationGenerator {
  return {
    scheme,
    async generateLine(line: LyricLine): Promise<GeneratedRomanization> {
      if (line.words !== undefined) {
        const wordTexts = line.words.map((word) => reverseText(word.text));
        return { text: wordTexts.join(" "), wordTexts };
      }
      return { text: reverseText(line.text) };
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

describe("generateForLine", () => {
  describe("delegates to generator.generateLine(line) and returns RomanizationData", () => {
    it("returns wordTexts when the generator returns wordTexts", async () => {
      registerGeneratorFactory("test-scheme", async () => ({
        scheme: "test-scheme",
        async generateLine(_line: LyricLine): Promise<GeneratedRomanization> {
          return { text: "yoru dakedo", wordTexts: ["yoru", "dakedo"] };
        },
      }));
      const line: LyricLine = {
        id: "L1",
        text: "夜 だけど",
        agentId: "v1",
        words: [
          { text: "夜", begin: 0, end: 1 },
          { text: "だけど", begin: 1, end: 2 },
        ],
      };
      const result = await generateForLine(line, "test-scheme");
      expect(result).toEqual({ text: "yoru dakedo", wordTexts: ["yoru", "dakedo"], source: "generated" });
    });

    it("returns line-level only when the generator returns no wordTexts", async () => {
      registerGeneratorFactory("test-scheme", async () => ({
        scheme: "test-scheme",
        async generateLine(_line: LyricLine): Promise<GeneratedRomanization> {
          return { text: "yoru dakedo" };
        },
      }));
      const line: LyricLine = { id: "L1", text: "夜 だけど", agentId: "v1" };
      const result = await generateForLine(line, "test-scheme");
      expect(result).toEqual({ text: "yoru dakedo", source: "generated" });
      expect("wordTexts" in result).toBe(false);
    });

    it("returns text-only romanization for a line-synced line by default", async () => {
      registerGeneratorFactory("zz-Latn-test", async () => makeReverseGenerator("zz-Latn-test"));
      const line: LyricLine = { id: "L1", text: "夜だけど", agentId: "v1", begin: 0, end: 2 };
      const result = await generateForLine(line, "zz-Latn-test");
      expect(result.source).toBe("generated");
      expect(result.wordTexts).toBeUndefined();
      expect(result.text).toBe(reverseText("夜だけど"));
    });

    it("returns text-only romanization for an untimed line", async () => {
      registerGeneratorFactory("zz-Latn-test", async () => makeReverseGenerator("zz-Latn-test"));
      const line: LyricLine = { id: "L1", text: "hello", agentId: "v1" };
      const result = await generateForLine(line, "zz-Latn-test");
      expect(result.wordTexts).toBeUndefined();
      expect(result.text).toBe("olleh");
    });

    it("returns RomanizationData typed with source: 'generated'", async () => {
      registerGeneratorFactory("zz-Latn-test", async () => makeReverseGenerator("zz-Latn-test"));
      const line: LyricLine = { id: "L1", text: "夜", agentId: "v1" };
      const result: RomanizationData = await generateForLine(line, "zz-Latn-test");
      expect(result.source).toBe("generated");
    });

    it("preserves the wordTexts array verbatim, including ordering and length", async () => {
      registerGeneratorFactory("test-scheme", async () => ({
        scheme: "test-scheme",
        async generateLine(_line: LyricLine): Promise<GeneratedRomanization> {
          return { text: "a b c", wordTexts: ["a", "b", "c"] };
        },
      }));
      const line: LyricLine = { id: "L1", text: "x y z", agentId: "v1" };
      const result = await generateForLine(line, "test-scheme");
      expect(result.wordTexts).toEqual(["a", "b", "c"]);
    });

    it("preserves an empty wordTexts array when the generator returns one", async () => {
      registerGeneratorFactory("test-scheme", async () => ({
        scheme: "test-scheme",
        async generateLine(_line: LyricLine): Promise<GeneratedRomanization> {
          return { text: "", wordTexts: [] };
        },
      }));
      const line: LyricLine = { id: "L1", text: "", agentId: "v1" };
      const result = await generateForLine(line, "test-scheme");
      expect(result.wordTexts).toEqual([]);
      expect(result.text).toBe("");
    });
  });

  describe("error handling", () => {
    it("throws on an unregistered scheme", async () => {
      const line: LyricLine = { id: "L1", text: "夜", agentId: "v1" };
      await expect(generateForLine(line, "zz-Latn-missing")).rejects.toThrow(/zz-Latn-missing/);
    });

    it("propagates errors from the generator factory and clears the cached promise", async () => {
      let calls = 0;
      registerGeneratorFactory("flaky-scheme", async () => {
        calls += 1;
        if (calls === 1) throw new Error("boot failure");
        return makeReverseGenerator("flaky-scheme");
      });

      const line: LyricLine = { id: "L1", text: "夜", agentId: "v1" };
      await expect(generateForLine(line, "flaky-scheme")).rejects.toThrow(/boot failure/);

      const result = await generateForLine(line, "flaky-scheme");
      expect(result.text).toBe(reverseText("夜"));
      expect(calls).toBe(2);
    });

    it("propagates errors thrown by generateLine without clearing the factory cache", async () => {
      let factoryCalls = 0;
      registerGeneratorFactory("test-scheme", async () => {
        factoryCalls += 1;
        return {
          scheme: "test-scheme",
          async generateLine(line: LyricLine): Promise<GeneratedRomanization> {
            if (line.text.includes("X")) throw new Error("simulated");
            return { text: reverseText(line.text) };
          },
        };
      });

      const bad: LyricLine = { id: "L1", text: "X", agentId: "v1" };
      await expect(generateForLine(bad, "test-scheme")).rejects.toThrow(/simulated/);

      const ok: LyricLine = { id: "L2", text: "夜", agentId: "v1" };
      const result = await generateForLine(ok, "test-scheme");
      expect(result.text).toBe(reverseText("夜"));
      expect(factoryCalls).toBe(1);
    });
  });

  describe("generator caching", () => {
    it("loads the generator only once per scheme on repeated successful calls", async () => {
      let factoryCalls = 0;
      registerGeneratorFactory("test-scheme", async () => {
        factoryCalls += 1;
        return makeReverseGenerator("test-scheme");
      });

      const line: LyricLine = { id: "L1", text: "夜", agentId: "v1" };
      await generateForLine(line, "test-scheme");
      await generateForLine(line, "test-scheme");
      await generateForLine(line, "test-scheme");

      expect(factoryCalls).toBe(1);
    });

    it("reuses the cached generator instance across calls", async () => {
      const generator = makeReverseGenerator("test-scheme");
      const spy = vi.spyOn(generator, "generateLine");
      registerGeneratorFactory("test-scheme", async () => generator);

      const line: LyricLine = { id: "L1", text: "夜", agentId: "v1" };
      await generateForLine(line, "test-scheme");
      await generateForLine(line, "test-scheme");

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("isolates the cache across schemes", async () => {
      let factoryACalls = 0;
      let factoryBCalls = 0;
      registerGeneratorFactory("scheme-a", async () => {
        factoryACalls += 1;
        return makeReverseGenerator("scheme-a");
      });
      registerGeneratorFactory("scheme-b", async () => {
        factoryBCalls += 1;
        return makeReverseGenerator("scheme-b");
      });

      const line: LyricLine = { id: "L1", text: "夜", agentId: "v1" };
      await generateForLine(line, "scheme-a");
      await generateForLine(line, "scheme-b");
      await generateForLine(line, "scheme-a");
      await generateForLine(line, "scheme-b");

      expect(factoryACalls).toBe(1);
      expect(factoryBCalls).toBe(1);
    });

    it("clearGeneratorCacheForTests forces the factory to run again", async () => {
      let factoryCalls = 0;
      registerGeneratorFactory("test-scheme", async () => {
        factoryCalls += 1;
        return makeReverseGenerator("test-scheme");
      });

      const line: LyricLine = { id: "L1", text: "夜", agentId: "v1" };
      await generateForLine(line, "test-scheme");
      clearGeneratorCacheForTests();
      await generateForLine(line, "test-scheme");

      expect(factoryCalls).toBe(2);
    });
  });

  describe("immutability and type integrity", () => {
    it("does not mutate the input line", async () => {
      registerGeneratorFactory("zz-Latn-test", async () => makeReverseGenerator("zz-Latn-test"));
      const words = [
        { text: "夜", begin: 0, end: 1 },
        { text: "だけど", begin: 1, end: 2 },
      ];
      const line: LyricLine = { id: "L1", text: "夜だけど", agentId: "v1", words };
      const snapshot = JSON.stringify(line);
      await generateForLine(line, "zz-Latn-test");
      expect(JSON.stringify(line)).toBe(snapshot);
    });

    it("omits wordTexts when undefined rather than serializing as null", async () => {
      registerGeneratorFactory("test-scheme", async () => ({
        scheme: "test-scheme",
        async generateLine(_line: LyricLine): Promise<GeneratedRomanization> {
          return { text: "olleh" };
        },
      }));
      const line: LyricLine = { id: "L1", text: "hello", agentId: "v1" };
      const result = await generateForLine(line, "test-scheme");
      expect(Object.hasOwn(result, "wordTexts")).toBe(false);
    });
  });
});
