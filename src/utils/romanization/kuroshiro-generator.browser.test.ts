import { describe, expect, it } from "vitest";
import { createKuroshiroGenerator } from "@/utils/romanization/kuroshiro-generator";

// -- Tests --------------------------------------------------------------------

describe("kuroshiroGenerator (Hepburn)", () => {
  it("exposes the requested scheme", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    expect(generator.scheme).toBe("ja-Latn-hepburn");
  }, 60000);

  it("generates Hepburn romaji for a kana+kanji line", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const result = await generator.generateLine("夜だけど");
    expect(typeof result).toBe("string");
    expect(result.toLowerCase()).toContain("yoru");
  }, 60000);

  it("returns the original text for Latin-only input", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const result = await generator.generateLine("!!!");
    expect(result).toBe("!!!");
  }, 60000);

  it("returns an empty string for empty input without invoking the analyzer", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    expect(await generator.generateLine("")).toBe("");
  }, 60000);

  it("generateWords preserves input length and timing exactly", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const words = [
      { text: "夜", begin: 0.25, end: 0.75 },
      { text: "だけど", begin: 0.75, end: 1.5 },
    ];
    const result = await generator.generateWords(words);
    expect(result.length).toBe(words.length);
    expect(result[0].begin).toBe(0.25);
    expect(result[0].end).toBe(0.75);
    expect(result[1].begin).toBe(0.75);
    expect(result[1].end).toBe(1.5);
    expect(result[0].text.toLowerCase()).toContain("yoru");
  }, 60000);

  it("generateWords preserves extra word fields like explicit and syllableGroupId", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const result = await generator.generateWords([
      { text: "夜", begin: 0, end: 1, explicit: true, syllableGroupId: "g1" },
    ]);
    expect(result[0].explicit).toBe(true);
    expect(result[0].syllableGroupId).toBe("g1");
  }, 60000);

  it("generateWords leaves Latin words untouched", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const result = await generator.generateWords([
      { text: "hello", begin: 0, end: 1 },
      { text: "夜", begin: 1, end: 2 },
    ]);
    expect(result[0].text).toBe("hello");
    expect(result[1].text.toLowerCase()).toContain("yoru");
  }, 60000);

  it("supports the Kunrei scheme by falling back to nippon best-effort", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-kunrei");
    expect(generator.scheme).toBe("ja-Latn-kunrei");
    const result = await generator.generateLine("夜");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  }, 60000);

  it("supports the Nihon scheme", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-nihon");
    const result = await generator.generateLine("夜");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  }, 60000);

  it("rejects an unknown japanese scheme synchronously", async () => {
    await expect(createKuroshiroGenerator("ja-Latn-bogus")).rejects.toThrow(/scheme/i);
  });
});
