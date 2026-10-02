import { describe, expect, it } from "vitest";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { parseTtml } from "@/utils/lyrics-parsers/ttml";
import { generateProjectTtml, generateTTML } from "@/utils/ttml";

const metadata: ProjectMetadata = { title: "One Step Closer", artists: [], album: "", duration: 60 };
const agents: Agent[] = [{ id: "v1", type: "person", name: "Frankie" }];

const wordSynced: LyricLine = {
  id: "w",
  text: "Comin' at you, baby",
  agentId: "v1",
  words: [
    { text: "Comin' ", begin: 1.437, end: 2.067 },
    { text: "at ", begin: 2.067, end: 2.382 },
    { text: "you, ", begin: 2.382, end: 2.649 },
    { text: "baby", begin: 2.649, end: 3.012 },
  ],
};
const lineSynced: LyricLine = { id: "l", text: "It's been too long", agentId: "v1", begin: 6.833, end: 8.893 };

const paragraphs = (ttml: string) => ttml.match(/<p [^>]*>.*?<\/p>/g) ?? [];

describe("generateTTML line timing", () => {
  describe("happy paths", () => {
    it("drops word spans and keeps the line bounds of a word-synced line", () => {
      const ttml = generateTTML({ metadata, agents, lines: [wordSynced], timing: "line" });
      expect(paragraphs(ttml)).toEqual([
        '<p begin="0:01.437" end="0:03.012" itunes:key="L1" ttm:agent="v1">Comin\' at you, baby</p>',
      ]);
    });

    it("writes a Line header for word-synced data", () => {
      const ttml = generateTTML({ metadata, agents, lines: [wordSynced], timing: "line" });
      expect(ttml).toContain('itunes:timing="Line" composer:timing="Line"');
    });

    it("leaves a line-synced line as it is", () => {
      const lineTtml = generateTTML({ metadata, agents, lines: [lineSynced], timing: "line" });
      expect(lineTtml).toBe(generateTTML({ metadata, agents, lines: [lineSynced] }));
    });
  });

  describe("edge cases", () => {
    it("writes the line text without split characters", () => {
      const split: LyricLine = {
        ...wordSynced,
        text: "Com|in' at you, baby",
        words: [{ text: "Com", begin: 1, end: 1.2 }, ...wordSynced.words!.map((word) => ({ ...word }))],
      };
      const [paragraph] = paragraphs(generateTTML({ metadata, agents, lines: [split], timing: "line" }));
      expect(paragraph).toContain(">Comin' at you, baby</p>");
    });

    it("times background vocals with their own bounds as one span", () => {
      const withBackground: LyricLine = {
        ...wordSynced,
        backgroundText: "(coming)",
        backgroundWords: [
          { text: "(com", begin: 2.5, end: 2.8 },
          { text: "ing)", begin: 2.8, end: 3.4 },
        ],
      };
      const [paragraph] = paragraphs(generateTTML({ metadata, agents, lines: [withBackground], timing: "line" }));
      expect(paragraph).toBe(
        '<p begin="0:01.437" end="0:03.400" itunes:key="L1" ttm:agent="v1">Comin\' at you, baby<span ttm:role="x-bg"><span begin="0:02.500" end="0:03.400">(coming)</span></span></p>',
      );
    });

    it("times untimed background vocals with the line", () => {
      const withBackground: LyricLine = { ...wordSynced, backgroundText: "(yeah)" };
      const [paragraph] = paragraphs(generateTTML({ metadata, agents, lines: [withBackground], timing: "line" }));
      expect(paragraph).toContain('<span ttm:role="x-bg"><span begin="0:01.437" end="0:03.012">(yeah)</span></span>');
    });
  });

  describe("regressions", () => {
    it("regression: writes aligned transliterations without word spans", () => {
      const romanized: LyricLine = {
        id: "r",
        text: "今日",
        agentId: "v1",
        words: [
          { text: "今", begin: 1, end: 1.5, transliteration: "kyou", transliterationJoinerAfter: " " },
          { text: "日", begin: 1.5, end: 2, transliteration: "hi" },
        ],
        backgroundText: "空",
        backgroundWords: [{ text: "空", begin: 1.2, end: 1.8, transliteration: "sora" }],
        transliteration: {
          language: "ja-Latn",
          text: "kyou hi",
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
      const ttml = generateTTML({ metadata, agents, lines: [romanized], timing: "line" });
      const transliteration = ttml.match(/<transliteration [^>]*>.*?<\/transliteration>/s)?.[0] ?? "";
      expect(transliteration).toContain("kyou hi");
      expect(transliteration).not.toContain("<span begin=");
      expect(generateTTML({ metadata, agents, lines: [romanized] })).toContain(">kyou</span>");
    });

    it("regression: strips split characters from background vocals", () => {
      const withBackground: LyricLine = {
        ...wordSynced,
        backgroundText: "(oo|ooh)",
        backgroundWords: [
          { text: "(oo", begin: 2.5, end: 2.8 },
          { text: "ooh)", begin: 2.8, end: 3.4 },
        ],
      };
      const [paragraph] = paragraphs(generateTTML({ metadata, agents, lines: [withBackground], timing: "line" }));
      expect(paragraph).toContain(">(ooooh)</span></span></p>");
    });
  });

  describe("invariants", () => {
    it("never writes a word span in the body", () => {
      const ttml = generateTTML({ metadata, agents, lines: [wordSynced, lineSynced], timing: "line" });
      for (const paragraph of paragraphs(ttml)) expect(paragraph).not.toMatch(/<p [^>]*><span begin=/);
    });

    it("does not change the lines it reads", () => {
      const lines = [structuredClone(wordSynced)];
      generateTTML({ metadata, agents, lines, timing: "line" });
      expect(lines).toEqual([wordSynced]);
    });

    it("reads back as line-synced lines with the same bounds", () => {
      const ttml = generateTTML({ metadata, agents, lines: [wordSynced, lineSynced], timing: "line" });
      const parsed = parseTtml(ttml).lines;
      expect(parsed.map((line) => [line.text, line.words, line.begin, line.end])).toEqual([
        ["Comin' at you, baby", undefined, 1.437, 3.012],
        ["It's been too long", undefined, 6.833, 8.893],
      ]);
    });
  });

  describe("project export", () => {
    it("follows the requested timing", () => {
      const project = { metadata, agents, lines: [wordSynced], groups: [] };
      expect(generateProjectTtml(project, 0, "line")).toBe(
        generateTTML({ ...project, timing: "line" }),
      );
      expect(generateProjectTtml(project, 0)).toContain("<span begin=");
    });
  });
});
