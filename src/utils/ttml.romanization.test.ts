import { describe, expect, it, vi } from "vitest";
import { generateTTML } from "@/utils/ttml";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import type { Agent } from "@/domain/agent/model";
import type { ProjectMetadata } from "@/domain/project/metadata";

const baseMeta: ProjectMetadata = {
  title: "Song",
  artist: "Artist",
  album: "Album",
  duration: 10,
};

const agents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

function wordSynced(): LyricLine {
  return reconcileLine({
    id: "raw-uuid-1",
    text: "夜だけど",
    agentId: "v1",
    words: [
      { text: "夜", begin: 0.5, end: 1.0 },
      { text: "だけど", begin: 1.0, end: 1.8 },
    ],
    romanization: {
      text: "yoru dakedo",
      wordTexts: ["yoru", "dakedo"],
      source: "generated",
      engine: "cutlet",
    },
  });
}

function lineSynced(): LyricLine {
  return reconcileLine({
    id: "raw-uuid-2",
    text: "夢の中",
    agentId: "v1",
    begin: 2.0,
    end: 3.5,
    romanization: { text: "yume no naka", source: "manual" },
  });
}

describe("generateTTML + itunes:key", () => {
  it("declares xmlns:itunes on the root element", () => {
    const out = generateTTML({
      metadata: baseMeta,
      agents,
      lines: [wordSynced()],
      granularity: "word",
    });
    expect(out).toContain('xmlns:itunes="http://music.apple.com/lyric-ttml-internal"');
  });

  it("assigns sequential L1, L2, ... to each emitted <p>", () => {
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [wordSynced(), lineSynced()],
      granularity: "word",
    });
    expect(out).toMatch(/<p[^>]*itunes:key="L1"[^>]*>/);
    expect(out).toMatch(/<p[^>]*itunes:key="L2"[^>]*>/);
  });

  it("skips a no-timing line when assigning Ln, so the next timed line gets the next ordinal", () => {
    const lines = [wordSynced(), reconcileLine({ id: "u3", text: "untimed", agentId: "v1" }), lineSynced()];
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines,
      granularity: "word",
    });
    expect(out).toMatch(/<p[^>]*itunes:key="L1"[^>]*>.*夜/);
    expect(out).toMatch(/<p[^>]*itunes:key="L2"[^>]*>.*夢/);
    expect(out).not.toContain('itunes:key="L3"');
  });

  it("does not leak internal line.id into the TTML", () => {
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [wordSynced()],
      granularity: "word",
    });
    expect(out).not.toContain("raw-uuid-1");
  });
});

describe("generateTTML + transliteration", () => {
  it("emits a single transliteration block per romanized line inside <head><metadata>", () => {
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [wordSynced(), lineSynced()],
      granularity: "word",
    });
    expect(out.match(/<transliteration /g)?.length).toBe(2);
    const headEnd = out.indexOf("</head>");
    expect(out.indexOf("<transliteration ")).toBeLessThan(headEnd);
    expect(out.indexOf("<transliteration ")).toBeGreaterThan(out.indexOf("<metadata>"));
  });

  it("puts for= on BOTH outer <transliteration> and inner <text>", () => {
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [wordSynced()],
      granularity: "word",
    });
    expect(out).toMatch(/<transliteration for="L1" xml:lang="ja-Latn-hepburn">/);
    expect(out).toMatch(/<text for="L1">/);
  });

  it("emits per-syllable spans from line.words timing (NOT independent timing)", () => {
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [wordSynced()],
      granularity: "word",
    });
    expect(out).toMatch(/<span begin="0:00\.500" end="0:01\.000">yoru<\/span>/);
    expect(out).toMatch(/<span begin="0:01\.000" end="0:01\.800">dakedo<\/span>/);
  });

  it("emits a line-level <text for=> with no spans when wordTexts is absent", () => {
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [lineSynced()],
      granularity: "word",
    });
    expect(out).toMatch(/<text for="L1">yume no naka<\/text>/);
    expect(out).not.toMatch(/<text for="L1">[^<]*<span/);
  });

  it("omits the block for a line without romanization", () => {
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [
        reconcileLine({
          id: "u4",
          text: "plain",
          agentId: "v1",
          begin: 0,
          end: 1,
        }),
      ],
      granularity: "word",
    });
    expect(out).not.toContain("<transliteration");
  });

  it("skips emission when romanizationScheme is empty, warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = generateTTML({
      metadata: baseMeta,
      agents,
      lines: [wordSynced(), lineSynced()],
      granularity: "word",
    });
    expect(out).not.toContain("<transliteration");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("metadata.romanizationScheme is empty");
    warn.mockRestore();
  });

  it("does not emit a block for a line whose romanization.text is empty even with scheme set", () => {
    const lineWithEmptyRomanization = reconcileLine({
      id: "u5",
      text: "夜",
      agentId: "v1",
      begin: 0,
      end: 1,
      romanization: { text: "", source: "manual" },
    });
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [lineWithEmptyRomanization],
      granularity: "word",
    });
    expect(out).not.toContain("<transliteration");
  });

  it("escapes XML special characters in romanization text and wordTexts", () => {
    const line = reconcileLine({
      id: "u6",
      text: "a&b",
      agentId: "v1",
      words: [
        { text: "a&b", begin: 0, end: 1 },
        { text: "c<d", begin: 1, end: 2 },
      ],
      romanization: {
        text: "a&b c<d",
        wordTexts: ["a&b", "c<d"],
        source: "manual",
      },
    });
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "und-Latn" },
      agents,
      lines: [line],
      granularity: "word",
    });
    expect(out).toContain(">a&amp;b<");
    expect(out).toContain(">c&lt;d<");
  });

  it("minify=true emits a single line without leading whitespace", () => {
    const out = generateTTML({
      metadata: { ...baseMeta, romanizationScheme: "ja-Latn-hepburn" },
      agents,
      lines: [wordSynced()],
      granularity: "word",
      minify: true,
    });
    expect(out).not.toContain("\n");
    expect(out).toContain('<transliteration for="L1" xml:lang="ja-Latn-hepburn">');
  });
});
