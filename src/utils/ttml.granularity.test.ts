import { describe, expect, it } from "vitest";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { generateTTML } from "@/utils/ttml";

const metadata: ProjectMetadata = { title: "T", artists: [], album: "", duration: 60 };
const agents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

const wordSynced: LyricLine = {
  id: "w",
  text: "Hello world",
  agentId: "v1",
  words: [
    { text: "Hello ", begin: 1, end: 1.5 },
    { text: "world", begin: 1.5, end: 2 },
  ],
};
const lineSynced: LyricLine = { id: "l", text: "Line only", agentId: "v1", begin: 3, end: 4 };

const paragraphs = (ttml: string) => ttml.match(/<p [^>]*>.*?<\/p>/g) ?? [];

describe("generateTTML timing granularity", () => {
  describe("happy paths", () => {
    it("emits word spans and a Word header for word-synced data", () => {
      const ttml = generateTTML({ metadata, agents, lines: [wordSynced] });
      expect(ttml).toContain('itunes:timing="Word" composer:timing="Word"');
      expect(ttml).toContain('<span begin="0:01.000" end="0:01.500">Hello</span> <span');
    });

    it("emits plain line text and a Line header for line-synced data", () => {
      const ttml = generateTTML({ metadata, agents, lines: [lineSynced] });
      expect(ttml).toContain('itunes:timing="Line" composer:timing="Line"');
      expect(paragraphs(ttml)[0]).toContain(">Line only</p>");
    });
  });

  describe("cross-field interactions", () => {
    it("decides word spans per line in a mixed project", () => {
      const [first, second] = paragraphs(generateTTML({ metadata, agents, lines: [wordSynced, lineSynced] }));
      expect(first).toContain("<span begin=");
      expect(second).not.toContain("<span");
      expect(second).toContain(">Line only</p>");
    });

    it("keeps background word spans on a line-synced main line", () => {
      const withBackground: LyricLine = {
        ...lineSynced,
        backgroundText: "(yeah)",
        backgroundWords: [{ text: "(yeah)", begin: 3.5, end: 4 }],
      };
      const [paragraph] = paragraphs(generateTTML({ metadata, agents, lines: [withBackground] }));
      expect(paragraph).toContain('<span ttm:role="x-bg"><span begin="0:03.500" end="0:04.000">(yeah)</span></span>');
    });
  });

  describe("regressions", () => {
    it("regression: the header never claims Word timing while the body drops every word span", () => {
      const ttml = generateTTML({ metadata, agents, lines: [wordSynced, lineSynced] });
      const claimsWord = ttml.includes('itunes:timing="Word"');
      const hasWordSpan = paragraphs(ttml).some((paragraph) => /<p [^>]*><span begin=/.test(paragraph));
      expect(claimsWord).toBe(hasWordSpan);
    });
  });
});

describe("D1 granularity header vs body", () => {
  it("keeps word spans when project granularity is line but data is word-timed", () => {
    const ttml = generateTTML({ metadata, agents, lines: [wordSynced] });
    expect(ttml).toContain('itunes:timing="Word"');
    expect(ttml).toContain("<span begin=");
  });
});
