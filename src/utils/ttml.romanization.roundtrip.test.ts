import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { generateTTML } from "@/utils/ttml";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");

const baseMetadata: ProjectMetadata = {
  title: "Round Trip",
  artist: "Tester",
  album: "Album",
  duration: 60,
  language: "ja",
  romanizationScheme: "ja-Latn-hepburn",
};

const agents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

// -- Round-trip tests ---------------------------------------------------------

describe("TTML round-trip · romanization", () => {
  it("word-synced romanization survives export -> import unchanged", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜 ", begin: 0, end: 1 },
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
    ];
    const ttml = generateTTML({ metadata: baseMetadata, agents, lines, granularity: "word" });
    const parsed = parseTtml(ttml);

    expect(parsed.metadata.romanizationScheme).toBe("ja-Latn-hepburn");
    expect(parsed.lines).toHaveLength(1);
    const line = parsed.lines[0];
    expect(line.romanization?.text).toBe("yoru dakedo");
    expect(line.romanization?.words?.length).toBe(2);
    expect(line.romanization?.words?.[0].text).toBe("yoru");
    expect(line.romanization?.words?.[0].begin).toBeCloseTo(0, 3);
    expect(line.romanization?.words?.[0].end).toBeCloseTo(1, 3);
    expect(line.romanization?.words?.[1].text).toBe("dakedo");
  });

  it("line-synced romanization survives export -> import unchanged", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        begin: 0,
        end: 4,
        romanization: { text: "yoru dakedo", source: "manual" },
      },
    ];
    const ttml = generateTTML({ metadata: baseMetadata, agents, lines, granularity: "line" });
    const parsed = parseTtml(ttml);

    expect(parsed.metadata.romanizationScheme).toBe("ja-Latn-hepburn");
    const line = parsed.lines[0];
    expect(line.romanization?.text).toBe("yoru dakedo");
    expect(line.romanization?.words).toBeUndefined();
  });

  it("mixed romanized + non-romanized lines preserve each line's state", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "夜",
        agentId: "v1",
        begin: 0,
        end: 1,
        romanization: { text: "yoru", source: "manual" },
      },
      { id: "L2", text: "hello", agentId: "v1", begin: 1, end: 2 },
      {
        id: "L3",
        text: "夢",
        agentId: "v1",
        begin: 2,
        end: 3,
        romanization: { text: "yume", source: "generated" },
      },
    ];
    const ttml = generateTTML({ metadata: baseMetadata, agents, lines, granularity: "line" });
    const parsed = parseTtml(ttml);

    expect(parsed.lines).toHaveLength(3);
    expect(parsed.lines[0].romanization?.text).toBe("yoru");
    expect(parsed.lines[1].romanization).toBeUndefined();
    expect(parsed.lines[2].romanization?.text).toBe("yume");
  });

  it("re-export -> re-import after a round-trip is idempotent on word timing", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "夜だけど",
        agentId: "v1",
        words: [
          { text: "夜 ", begin: 0.833, end: 1.195 },
          { text: "だけど", begin: 1.195, end: 1.887 },
        ],
        romanization: {
          text: "doudemo ii youna",
          source: "generated",
          words: [
            { text: "doudemo", begin: 0.833, end: 1.195 },
            { text: "ii youna", begin: 1.195, end: 1.887 },
          ],
        },
      },
    ];
    const ttml1 = generateTTML({ metadata: baseMetadata, agents, lines, granularity: "word" });
    const parsed1 = parseTtml(ttml1);
    const ttml2 = generateTTML({
      metadata: { ...baseMetadata, ...parsed1.metadata },
      agents,
      lines: parsed1.lines,
      granularity: "word",
    });
    const parsed2 = parseTtml(ttml2);
    expect(parsed2.lines[0].romanization?.words?.[0].text).toBe("doudemo");
    expect(parsed2.lines[0].romanization?.words?.[0].begin).toBeCloseTo(0.833, 3);
    expect(parsed2.lines[0].romanization?.words?.[1].text).toBe("ii youna");
    expect(parsed2.metadata.romanizationScheme).toBe("ja-Latn-hepburn");
  });

  it("scheme unset on a project that has romanization data does not export or recover it", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "夜",
        agentId: "v1",
        begin: 0,
        end: 1,
        romanization: { text: "yoru", source: "manual" },
      },
    ];
    const ttml = generateTTML({
      metadata: { ...baseMetadata, romanizationScheme: undefined },
      agents,
      lines,
      granularity: "line",
    });
    const parsed = parseTtml(ttml);
    expect(parsed.metadata.romanizationScheme).toBeUndefined();
    expect(parsed.lines[0].romanization).toBeUndefined();
  });

  it("composer-minimal fixture parses with the same shape it was authored in", () => {
    const ttml = readFileSync(resolve(FIXTURES_DIR, "composer-romanized-minimal.ttml"), "utf-8");
    const parsed = parseTtml(ttml);
    expect(parsed.metadata.romanizationScheme).toBe("ja-Latn-hepburn");
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].romanization?.words?.length).toBe(2);
    expect(parsed.lines[0].romanization?.text).toBe("doudemo ii youna");
    expect(parsed.lines[1].romanization?.text).toBe("yume no naka");
    expect(parsed.lines[1].romanization?.words).toBeUndefined();
  });

  it("re-importing a dual-shape TTML preserves romanization without duplication", () => {
    const lines: LyricLine[] = [
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
      {
        id: "L2",
        text: "夢",
        agentId: "v1",
        begin: 2,
        end: 3,
        romanization: { text: "yume", source: "manual" },
      },
    ];
    const ttml = generateTTML({ metadata: baseMetadata, agents, lines, granularity: "word" });

    expect(ttml).toContain('<transliteration xml:lang="ja-Latn-hepburn">');
    expect(ttml).toContain('<transliteration for="L1"');
    expect(ttml).toContain('<transliteration for="L2"');

    const parsed = parseTtml(ttml);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].romanization?.text).toBe("yoru dakedo");
    expect(parsed.lines[0].romanization?.words?.length).toBe(2);
    expect(parsed.lines[1].romanization?.text).toBe("yume");
    expect(parsed.lines[1].romanization?.words).toBeUndefined();
  });

  it("Apple shape wins on re-import when both shapes are present (no double-application)", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "夜",
        agentId: "v1",
        words: [{ text: "夜", begin: 0.5, end: 1.5 }],
        romanization: {
          text: "yoru",
          source: "generated",
          words: [{ text: "yoru", begin: 0.5, end: 1.5 }],
        },
      },
    ];
    const ttml = generateTTML({ metadata: baseMetadata, agents, lines, granularity: "word" });

    const parsed = parseTtml(ttml);
    expect(parsed.lines[0].romanization?.words?.length).toBe(1);
    expect(parsed.lines[0].romanization?.words?.[0].text).toBe("yoru");
    expect(parsed.lines[0].romanization?.words?.[0].begin).toBeCloseTo(0.5, 3);
    expect(parsed.lines[0].romanization?.words?.[0].end).toBeCloseTo(1.5, 3);
  });
});
