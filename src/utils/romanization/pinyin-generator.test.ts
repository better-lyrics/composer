import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { createPinyinGenerator } from "@/utils/romanization/pinyin-generator";

// -- Helpers ------------------------------------------------------------------

function makeLine(text: string, partial?: Partial<LyricLine>): LyricLine {
  return { id: "L1", text, agentId: "v1", ...partial } as LyricLine;
}

// -- Tests --------------------------------------------------------------------

describe("pinyinGenerator (Pinyin)", () => {
  it("exposes the requested scheme", async () => {
    const generator = await createPinyinGenerator("zh-Latn-pinyin");
    expect(generator.scheme).toBe("zh-Latn-pinyin");
  });

  it("generates Pinyin with tone marks by default", async () => {
    const generator = await createPinyinGenerator("zh-Latn-pinyin");
    const result = await generator.generateLine(makeLine("你好"));
    expect(typeof result.text).toBe("string");
    expect(result.text.toLowerCase()).toContain("nǐ");
  });

  it("returns Latin input unchanged", async () => {
    const generator = await createPinyinGenerator("zh-Latn-pinyin");
    const result = await generator.generateLine(makeLine("hello world"));
    expect(result.text).toBe("hello world");
  });

  it("returns empty string for empty input", async () => {
    const generator = await createPinyinGenerator("zh-Latn-pinyin");
    const result = await generator.generateLine(makeLine(""));
    expect(result.text).toBe("");
  });

  it("returns whole-line pinyin for a word-synced line", async () => {
    const generator = await createPinyinGenerator("zh-Latn-pinyin");
    const line = makeLine("你好", {
      words: [
        { text: "你", begin: 0.1, end: 0.5 },
        { text: "好", begin: 0.5, end: 1 },
      ],
    });
    const result = await generator.generateLine(line);
    expect(typeof result.text).toBe("string");
    expect(result.text.toLowerCase()).toContain("nǐ");
    expect(result.text.toLowerCase()).toContain("hǎo");
  });

  it("ignores word-level metadata on the input line and reads only line.text", async () => {
    const generator = await createPinyinGenerator("zh-Latn-pinyin");
    const line = makeLine("你", {
      words: [{ text: "你", begin: 0, end: 1, explicit: true, syllableGroupId: "g1" }],
    });
    const result = await generator.generateLine(line);
    expect(result.text.toLowerCase()).toContain("nǐ");
  });
});

describe("pinyinGenerator (Wade-Giles)", () => {
  it("returns plain Latin output without tone marks for the Wade-Giles best-effort scheme", async () => {
    const generator = await createPinyinGenerator("zh-Latn-wadegiles");
    expect(generator.scheme).toBe("zh-Latn-wadegiles");
    const result = await generator.generateLine(makeLine("你好"));
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
    expect(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(result.text)).toBe(false);
  });
});

describe("pinyinGenerator (errors)", () => {
  it("rejects an unknown chinese scheme", async () => {
    await expect(createPinyinGenerator("zh-Latn-bogus")).rejects.toThrow(/scheme/i);
  });
});
