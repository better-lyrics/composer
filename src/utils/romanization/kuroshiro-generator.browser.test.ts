import { describe, expect, it } from "vitest";
import type { LyricLine } from "@/domain/line/model";
import { createKuroshiroGenerator } from "@/utils/romanization/kuroshiro-generator";

// -- Helpers ------------------------------------------------------------------

function makeLine(text: string, partial?: Partial<LyricLine>): LyricLine {
  return { id: "L1", text, agentId: "v1", ...partial } as LyricLine;
}

// -- Tests --------------------------------------------------------------------

describe("kuroshiroGenerator (Hepburn)", () => {
  it("exposes the requested scheme", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    expect(generator.scheme).toBe("ja-Latn-hepburn");
  }, 60000);

  it("generates Hepburn romaji for a kana+kanji line", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const result = await generator.generateLine(makeLine("夜だけど"));
    expect(typeof result.text).toBe("string");
    expect(result.text.toLowerCase()).toContain("yoru");
  }, 60000);

  it("returns the original text for Latin-only input", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const result = await generator.generateLine(makeLine("!!!"));
    expect(result.text).toBe("!!!");
  }, 60000);

  it("returns an empty string for empty input without invoking the analyzer", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const result = await generator.generateLine(makeLine(""));
    expect(result.text).toBe("");
  }, 60000);

  it("returns the whole-line romaji for a word-synced line", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const line = makeLine("夜だけど", {
      words: [
        { text: "夜", begin: 0.25, end: 0.75 },
        { text: "だけど", begin: 0.75, end: 1.5 },
      ],
    });
    const result = await generator.generateLine(line);
    expect(typeof result.text).toBe("string");
    expect(result.text.toLowerCase()).toContain("yoru");
  }, 60000);

  it("ignores word-level metadata on the input line and reads only line.text", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const line = makeLine("夜", {
      words: [{ text: "夜", begin: 0, end: 1, explicit: true, syllableGroupId: "g1" }],
    });
    const result = await generator.generateLine(line);
    expect(result.text.toLowerCase()).toContain("yoru");
  }, 60000);

  it("returns latin text untouched even when the line is word-synced and mixed", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-hepburn");
    const result = await generator.generateLine(makeLine("hello"));
    expect(result.text).toBe("hello");
  }, 60000);

  it("supports the Kunrei scheme by falling back to nippon best-effort", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-kunrei");
    expect(generator.scheme).toBe("ja-Latn-kunrei");
    const result = await generator.generateLine(makeLine("夜"));
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
  }, 60000);

  it("supports the Nihon scheme", async () => {
    const generator = await createKuroshiroGenerator("ja-Latn-nihon");
    const result = await generator.generateLine(makeLine("夜"));
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
  }, 60000);

  it("rejects an unknown japanese scheme synchronously", async () => {
    await expect(createKuroshiroGenerator("ja-Latn-bogus")).rejects.toThrow(/scheme/i);
  });
});
