import type { Agent } from "@/domain/agent/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { generateTTML } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const baseMetadata: ProjectMetadata = {
  title: "Test",
  artist: "Test Artist",
  album: "Test Album",
  duration: 60,
  language: "ja",
};

const baseAgents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

// -- Export tests -------------------------------------------------------------

describe("TTML export · transliterations", () => {
  it("emits <transliterations> when scheme is set and a line has romanization", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [
        {
          id: "L1",
          text: "夜だけど",
          agentId: "v1",
          words: [
            { text: "夜", begin: 0, end: 1 },
            { text: "だけど", begin: 1, end: 2 },
          ],
          romanization: {
            text: "yoru dakedo",
            source: "generated",
            words: [
              { text: "yoru", begin: 0, end: 1 },
              { text: "dakedo", begin: 1, end: 2 },
            ],
          },
        },
      ],
      granularity: "word",
    });

    expect(ttml).toContain("<transliterations>");
    expect(ttml).toContain('<transliteration xml:lang="ja-Latn-hepburn">');
    expect(ttml).toContain('<text for="L1">');
    expect(ttml).toMatch(/<span begin="0:00\.000" end="0:01\.000">yoru<\/span>/);
    expect(ttml).toMatch(/<span begin="0:01\.000" end="0:02\.000">dakedo<\/span>/);
    expect(ttml).toContain("</transliteration>");
    expect(ttml).toContain("</transliterations>");
  });

  it("emits no <transliterations> when scheme is unset", () => {
    const ttml = generateTTML({
      metadata: baseMetadata,
      agents: baseAgents,
      lines: [
        {
          id: "L1",
          text: "夜だけど",
          agentId: "v1",
          begin: 0,
          end: 2,
          romanization: { text: "yoru dakedo", source: "manual" },
        },
      ],
      granularity: "line",
    });
    expect(ttml).not.toContain("<transliterations>");
    expect(ttml).not.toContain("<transliteration");
  });

  it("emits no <transliterations> when scheme set but no line has romanization", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [{ id: "L1", text: "hello", agentId: "v1", begin: 0, end: 1 }],
      granularity: "line",
    });
    expect(ttml).not.toContain("<transliterations>");
  });

  it("emits a single inline text for a line-synced romanization (no word spans)", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [
        {
          id: "L1",
          text: "夜だけど",
          agentId: "v1",
          begin: 0,
          end: 4,
          romanization: { text: "yoru dakedo", source: "manual" },
        },
      ],
      granularity: "line",
    });
    expect(ttml).toContain('<text for="L1">yoru dakedo</text>');
  });

  it("escapes XML special chars in romanization text", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [
        {
          id: "L1",
          text: "夜だけど",
          agentId: "v1",
          begin: 0,
          end: 2,
          romanization: { text: "a < b & c", source: "manual" },
        },
      ],
      granularity: "line",
    });
    expect(ttml).toContain("a &lt; b &amp; c");
  });

  it("escapes `<` and `&` in the for attribute", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [
        {
          id: "L<1&",
          text: "夜",
          agentId: "v1",
          begin: 0,
          end: 1,
          romanization: { text: "yoru", source: "manual" },
        },
      ],
      granularity: "line",
    });
    expect(ttml).toContain('<text for="L&lt;1&amp;"');
    const parsed = new DOMParser().parseFromString(ttml, "application/xml");
    expect(parsed.getElementsByTagName("parsererror").length).toBe(0);
  });

  it("emits <composer:generator> with version and url inside metadata when transliterations are present", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [
        {
          id: "L1",
          text: "夜",
          agentId: "v1",
          begin: 0,
          end: 1,
          romanization: { text: "yoru", source: "manual" },
        },
      ],
      granularity: "line",
    });
    expect(ttml).toMatch(/<composer:generator version="[^"]+" url="https:\/\/composer\.boidu\.dev"\/>/);
    const generatorIdx = ttml.indexOf("<composer:generator");
    const transliterationsIdx = ttml.indexOf("<transliterations>");
    const metadataCloseIdx = ttml.indexOf("</metadata>");
    expect(generatorIdx).toBeGreaterThan(-1);
    expect(transliterationsIdx).toBeGreaterThan(generatorIdx);
    expect(metadataCloseIdx).toBeGreaterThan(transliterationsIdx);
  });

  it("uses the configured scheme on the <transliteration> xml:lang", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "zh-Latn-pinyin" },
      agents: baseAgents,
      lines: [
        {
          id: "L1",
          text: "你好",
          agentId: "v1",
          begin: 0,
          end: 1,
          romanization: { text: "nǐ hǎo", source: "manual" },
        },
      ],
      granularity: "line",
    });
    expect(ttml).toContain('<transliteration xml:lang="zh-Latn-pinyin">');
  });

  it("skips lines without romanization but still emits ones that do", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [
        { id: "L1", text: "hello", agentId: "v1", begin: 0, end: 1 },
        {
          id: "L2",
          text: "夜",
          agentId: "v1",
          begin: 1,
          end: 2,
          romanization: { text: "yoru", source: "manual" },
        },
      ],
      granularity: "line",
    });
    expect(ttml).not.toContain('<text for="L1"');
    expect(ttml).toContain('<text for="L2">yoru</text>');
  });

  it("emits itunes:key on <p> so transliteration <text for=...> can map back on re-import", () => {
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [
        {
          id: "L1",
          text: "夜",
          agentId: "v1",
          begin: 0,
          end: 1,
          romanization: { text: "yoru", source: "manual" },
        },
      ],
      granularity: "line",
    });
    expect(ttml).toContain('xmlns:itunes="http://music.apple.com/lyric-ttml-internal"');
    expect(ttml).toMatch(/itunes:key="L1"/);
  });
});

describe("TTML export · itunes:key emission", () => {
  it("emits itunes:key on every <p> even without transliterations (matches Apple TTML)", () => {
    const ttml = generateTTML({
      metadata: baseMetadata,
      agents: baseAgents,
      lines: [
        { id: "L1", text: "hello", agentId: "v1", begin: 0, end: 1 },
        { id: "L2", text: "world", agentId: "v1", begin: 1, end: 2 },
      ],
      granularity: "line",
    });
    expect(ttml).toMatch(/<p [^>]*itunes:key="L1"/);
    expect(ttml).toMatch(/<p [^>]*itunes:key="L2"/);
  });

  it("emits itunes:key consistently across romanization on/off toggles", () => {
    const lines = [{ id: "L1", text: "hello", agentId: "v1", begin: 0, end: 1 }];
    const withoutRomanization = generateTTML({
      metadata: baseMetadata,
      agents: baseAgents,
      lines,
      granularity: "line",
    });
    const withRomanization = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: "ja-Latn-hepburn" },
      agents: baseAgents,
      lines: [{ ...lines[0], romanization: { text: "hola", source: "manual" } }],
      granularity: "line",
    });
    expect(withoutRomanization).toMatch(/itunes:key="L1"/);
    expect(withRomanization).toMatch(/itunes:key="L1"/);
  });
});
