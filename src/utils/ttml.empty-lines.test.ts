import { describe, expect, it } from "vitest";
import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { generateTTML } from "@/utils/ttml";

const baseMetadata: ProjectMetadata = { title: "Test", artists: [], album: "", duration: 60 };
const baseAgents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

function exportLines(lines: LyricLine[]): string {
  return generateTTML({ metadata: baseMetadata, agents: baseAgents, lines, groups: [], granularity: "word" });
}

function paragraphs(ttml: string): string[] {
  return ttml.match(/<p [^>]*>.*?<\/p>/g) ?? [];
}

describe("ttml export · empty lines", () => {
  it("exports lines that have lyrics", () => {
    const ttml = exportLines([{ id: "a", text: "hello", agentId: "v1", begin: 1, end: 2 }]);
    expect(paragraphs(ttml)).toHaveLength(1);
  });

  describe("regressions", () => {
    it("regression: skips a timed line with no text instead of writing an empty paragraph", () => {
      const ttml = exportLines([
        { id: "a", text: "hello", agentId: "v1", begin: 1, end: 2 },
        { id: "b", text: "", agentId: "v1", begin: 3, end: 4 },
        { id: "c", text: "world", agentId: "v1", begin: 5, end: 6 },
      ]);
      expect(paragraphs(ttml)).toHaveLength(2);
      expect(ttml).not.toMatch(/<p [^>]*><\/p>/);
    });
  });

  describe("edge cases", () => {
    it("skips a timed line whose text is only whitespace", () => {
      expect(paragraphs(exportLines([{ id: "b", text: "   ", agentId: "v1", begin: 3, end: 4 }]))).toHaveLength(0);
    });

    it("skips a timed line whose text is only a split character", () => {
      expect(paragraphs(exportLines([{ id: "b", text: "|", agentId: "v1", begin: 3, end: 4 }]))).toHaveLength(0);
    });

    it("keeps a timed line with no main text but background vocals", () => {
      const ttml = exportLines([{ id: "b", text: "", agentId: "v1", begin: 3, end: 4, backgroundText: "ooh" }]);
      expect(paragraphs(ttml)).toHaveLength(1);
      expect(ttml).toContain('ttm:role="x-bg"');
    });

    it("keeps an empty-text line whose background words are timed", () => {
      const ttml = exportLines([
        {
          id: "b",
          text: "",
          agentId: "v1",
          begin: 3,
          end: 4,
          backgroundText: "ooh",
          backgroundWords: [{ text: "ooh", begin: 3, end: 3.5 }],
        },
      ]);
      expect(ttml).toContain(">ooh</span>");
    });

    it("exports nothing for a project of only empty lines", () => {
      const ttml = exportLines([
        { id: "a", text: "", agentId: "v1", begin: 1, end: 2 },
        { id: "b", text: "", agentId: "v1" },
      ]);
      expect(paragraphs(ttml)).toHaveLength(0);
    });
  });

  describe("invariants", () => {
    it("never writes an empty paragraph whatever mix of lines it gets", () => {
      const ttml = exportLines([
        { id: "a", text: "", agentId: "v1", begin: 0, end: 1 },
        {
          id: "b",
          text: "one two",
          agentId: "v1",
          words: [
            { text: "one ", begin: 1, end: 1.5 },
            { text: "two", begin: 1.5, end: 2 },
          ],
        },
        { id: "c", text: " ", agentId: "v1", begin: 2, end: 3 },
        { id: "d", text: "", agentId: "v1" },
      ]);
      expect(ttml).not.toMatch(/<p [^>]*><\/p>/);
      expect(paragraphs(ttml)).toHaveLength(1);
    });
  });
});
