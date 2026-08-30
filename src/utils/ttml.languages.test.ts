import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

const metadata: ProjectMetadata = { title: "Languages", artist: "", album: "", duration: 10, language: "ja" };
const agents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

function languageLine(): LyricLine {
  return {
    id: "line-1",
    text: "今日",
    agentId: "v1",
    words: [
      { text: "今", begin: 1, end: 1.5, transliteration: "kyou" },
      { text: "日", begin: 1.5, end: 2, transliteration: "hi" },
    ],
    backgroundText: "空",
    backgroundWords: [{ text: "空", begin: 1.2, end: 1.8, transliteration: "sora" }],
    backgroundTextSource: "manual",
    translations: {
      en: {
        language: "en",
        text: "Today",
        backgroundText: "Sky",
        origin: "manual",
        sourceFingerprint: "test",
      },
    },
    transliteration: {
      language: "ja-Latn",
      text: "kyou-hi",
      backgroundText: "sora",
      segments: [
        { original: "今", transliteration: "kyou" },
        { original: "日", transliteration: "hi" },
      ],
      backgroundSegments: [{ original: "空", transliteration: "sora" }],
      origin: "manual",
      sourceFingerprint: "test",
    },
  };
}

describe("TTML alternate-language sidecars", () => {
  it("emits line keys, translations, timed transliterations, and untimed spaces", () => {
    const ttml = generateTTML({ metadata, agents, lines: [languageLine()], granularity: "word" });
    expect(ttml).toContain('itunes:key="L1"');
    expect(ttml).toContain('<translation xml:lang="en" type="subtitle">');
    expect(ttml).toContain('<transliteration xml:lang="ja-Latn">');
    expect(ttml).toContain(">kyou</span> <span");
    expect(ttml).toContain('<text for="L1">Today <span ttm:role="x-bg">Sky</span></text>');
    expect(ttml).toMatch(/>hi<\/span> <span ttm:role="x-bg">/);
  });

  it("places alternate background text first when it begins before the foreground", () => {
    const line = languageLine();
    line.backgroundWords = [{ text: "空", begin: 0.5, end: 0.9, transliteration: "sora" }];

    const ttml = generateTTML({ metadata, agents, lines: [line], granularity: "word" });

    expect(ttml).toContain('<text for="L1"><span ttm:role="x-bg">Sky </span>Today</text>');
    expect(ttml).toMatch(
      /<text for="L1"><span ttm:role="x-bg"><span[^>]*>sora<\/span> <\/span><span[^>]*>kyou<\/span>/,
    );
  });

  it("places alternate background text in a foreground timing break", () => {
    const line = languageLine();
    line.text = "今 日";
    line.words = [
      { text: "今 ", begin: 1, end: 1.4, transliteration: "kyou" },
      { text: "日", begin: 2, end: 2.5, transliteration: "hi" },
    ];
    line.backgroundWords = [{ text: "空", begin: 1.6, end: 1.9, transliteration: "sora" }];
    line.translations!.en.text = "Right now";
    line.transliteration!.text = "kyou hi";
    line.transliteration!.segments = [{ original: "今 日", transliteration: "kyou hi" }];

    const ttml = generateTTML({ metadata, agents, lines: [line], granularity: "word" });

    expect(ttml).toContain('<text for="L1">Right <span ttm:role="x-bg">Sky </span>now</text>');
    expect(ttml).toMatch(
      /<text for="L1"><span[^>]*>kyou<\/span> <span ttm:role="x-bg"><span[^>]*>sora<\/span> <\/span><span[^>]*>hi<\/span>/,
    );
    const parsed = parseLyricsFile("song.ttml", ttml).lines[0];
    expect(parsed.translations?.en.text).toBe("Right now");
    expect(parsed.translations?.en.backgroundText).toBe("Sky");
  });

  it("round-trips main and background alternate text", () => {
    const ttml = generateTTML({ metadata, agents, lines: [languageLine()], granularity: "word" });
    const parsed = parseLyricsFile("song.ttml", ttml).lines[0];
    expect(parsed.translations?.en.text).toBe("Today");
    expect(parsed.translations?.en.backgroundText).toBe("Sky");
    expect(parsed.transliteration?.text).toBe("kyou-hi");
    expect(parsed.transliteration?.backgroundText).toBe("sora");
    expect(parsed.words?.map((word) => word.transliteration)).toEqual(["kyou", "hi"]);
  });

  it("exports dashes as untimed syllable spaces and word boundaries as two spaces", () => {
    const line = languageLine();
    line.text = "今日 は";
    line.words = [
      { text: "今日 ", begin: 1, end: 2, transliteration: "kyou hi" },
      { text: "は", begin: 2, end: 2.5, transliteration: "wa" },
    ];
    line.transliteration!.text = "kyou-hi wa";
    line.transliteration!.segments = [{ original: "今日 は", transliteration: "kyou-hi wa" }];
    const ttml = generateTTML({ metadata, agents, lines: [line], granularity: "word" });
    expect(ttml).toContain(">kyou</span> <span begin=");
    expect(ttml).toMatch(/>hi<\/span> {2}<span[^>]*>wa<\/span>/);
    expect(ttml).not.toMatch(/<span[^>]*>kyou hi<\/span>/);
    const parsed = parseLyricsFile("song.ttml", ttml).lines[0];
    expect(parsed.transliteration?.text).toBe("kyou-hi wa");
  });

  it("keeps matching alternate tracks in the exported TTML for renderers to filter", () => {
    const line = languageLine();
    line.text = "今|日";
    line.translations!.en.text = "今日";
    line.transliteration!.text = "今日";

    const ttml = generateTTML({
      metadata,
      agents,
      lines: [line],
      granularity: "word",
    });

    expect(ttml).toContain("<translations>");
    expect(ttml).toContain("<transliterations>");
  });

  it("keeps case and punctuation variants in the exported TTML", () => {
    const line = languageLine();
    line.text = "Today";
    line.translations!.en.text = "today";
    line.transliteration!.text = "To-day";

    const ttml = generateTTML({
      metadata,
      agents,
      lines: [line],
      granularity: "word",
    });

    expect(ttml).toContain('<translation xml:lang="en" type="subtitle">');
    expect(ttml).toContain('<transliteration xml:lang="ja-Latn">');
  });
});
