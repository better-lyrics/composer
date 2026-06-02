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

describe("syllable-aware wordTexts alignment", () => {
  it("returns wordTexts: one entry per source word, joined per-character pinyin", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = {
      id: "L1",
      text: "重庆",
      agentId: "v1",
      words: [
        { text: "重", begin: 0, end: 1 },
        { text: "庆", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toEqual(["chóng", "qìng"]);
  });

  it("multi-character source words: each word's slice joined with spaces", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = {
      id: "L1",
      text: "你好世界",
      agentId: "v1",
      words: [
        { text: "你好", begin: 0, end: 1 },
        { text: "世界", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toEqual(["nǐ hǎo", "shì jiè"]);
  });

  it("preserves polyphone reading via whole-line context (银行 = yín háng, not yín xíng)", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = {
      id: "L1",
      text: "银行",
      agentId: "v1",
      words: [
        { text: "银", begin: 0, end: 1 },
        { text: "行", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toEqual(["yín", "háng"]);
  });

  it("respects split characters in source word text", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = {
      id: "L1",
      text: "你好|世界",
      agentId: "v1",
      words: [
        { text: "你好", begin: 0, end: 1 },
        { text: "世|界", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toEqual(["nǐ hǎo", "shì jiè"]);
  });

  it("falls back to text-only when concatenated source words do not equal line.text", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = {
      id: "L1",
      text: "你好",
      agentId: "v1",
      words: [{ text: "再见", begin: 0, end: 1 }],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toBeUndefined();
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("falls back to text-only when line has no words array (line-synced)", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = { id: "L1", text: "你好", agentId: "v1", begin: 0, end: 2 };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toBeUndefined();
  });

  it("returns ASCII-only text unchanged (no Chinese script)", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = {
      id: "L1",
      text: "hello world",
      agentId: "v1",
      words: [
        { text: "hello", begin: 0, end: 1 },
        { text: "world", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.text).toBe("hello world");
  });

  it("emits Wade-Giles best-effort (tone-mark-free pinyin) when scheme is zh-Latn-wadegiles", async () => {
    const gen = await createPinyinGenerator("zh-Latn-wadegiles");
    const line: LyricLine = {
      id: "L1",
      text: "重庆",
      agentId: "v1",
      words: [
        { text: "重", begin: 0, end: 1 },
        { text: "庆", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toEqual(["chong", "qing"]);
  });

  it("preserves the line.text return field as the joined wordTexts", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = {
      id: "L1",
      text: "重庆",
      agentId: "v1",
      words: [
        { text: "重", begin: 0, end: 1 },
        { text: "庆", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.text).toBe(result.wordTexts?.join(" "));
  });

  it("mixed Chinese + ASCII characters in a single source word are tolerated", async () => {
    const gen = await createPinyinGenerator("zh-Latn-pinyin");
    const line: LyricLine = {
      id: "L1",
      text: "你好A",
      agentId: "v1",
      words: [
        { text: "你好", begin: 0, end: 1 },
        { text: "A", begin: 1, end: 2 },
      ],
    };
    const result = await gen.generateLine(line);
    expect(result.wordTexts).toEqual(["nǐ hǎo", "A"]);
  });
});
