import { describe, expect, it } from "vitest";
import type { Agent } from "insync/agent";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "insync/line";
import type { ProjectMetadata } from "insync/metadata";
import { generateTTML } from "@/utils/ttml";
import { DEFAULT_SPLIT_CHARACTER } from "@/utils/split-character-text";

const baseMetadata: ProjectMetadata = { title: "Test", artists: [], album: "", duration: 60 };
const baseAgents: Agent[] = [{ id: "v1", type: "person", name: "Lead" }];

function exportLines(lines: LyricLine[]): string {
  return generateTTML({
    metadata: baseMetadata,
    agents: baseAgents,
    lines,
    groups: [],
    splitChar: DEFAULT_SPLIT_CHARACTER,
  });
}

function paragraphs(ttml: string): string[] {
  return ttml.match(/<p [^>]*>.*?<\/p>/g) ?? [];
}

describe("ttml export · empty lines", () => {
  it("exports lines that have lyrics", () => {
    const ttml = exportLines([
      lineFromFields({ id: "a", text: "hello", agentId: "v1", begin: 1, end: 2 }, DEFAULT_SPLIT_CHARACTER),
    ]);
    expect(paragraphs(ttml)).toHaveLength(1);
  });

  describe("regressions", () => {
    it("regression: skips a timed line with no text instead of writing an empty paragraph", () => {
      const ttml = exportLines([
        lineFromFields({ id: "a", text: "hello", agentId: "v1", begin: 1, end: 2 }, DEFAULT_SPLIT_CHARACTER),
        lineFromFields({ id: "b", text: "", agentId: "v1", begin: 3, end: 4 }, DEFAULT_SPLIT_CHARACTER),
        lineFromFields({ id: "c", text: "world", agentId: "v1", begin: 5, end: 6 }, DEFAULT_SPLIT_CHARACTER),
      ]);
      expect(paragraphs(ttml)).toHaveLength(2);
      expect(ttml).not.toMatch(/<p [^>]*><\/p>/);
    });
  });

  describe("edge cases", () => {
    it("skips a timed line whose text is only whitespace", () => {
      expect(
        paragraphs(
          exportLines([
            lineFromFields({ id: "b", text: "   ", agentId: "v1", begin: 3, end: 4 }, DEFAULT_SPLIT_CHARACTER),
          ]),
        ),
      ).toHaveLength(0);
    });

    it("skips a timed line whose text is only a split character", () => {
      expect(
        paragraphs(
          exportLines([
            lineFromFields({ id: "b", text: "|", agentId: "v1", begin: 3, end: 4 }, DEFAULT_SPLIT_CHARACTER),
          ]),
        ),
      ).toHaveLength(0);
    });

    it("keeps a timed line with no main text but background vocals", () => {
      const ttml = exportLines([
        lineFromFields(
          { id: "b", text: "", agentId: "v1", begin: 3, end: 4, backgroundText: "ooh" },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ]);
      expect(paragraphs(ttml)).toHaveLength(1);
      expect(ttml).toContain('ttm:role="x-bg"');
    });

    it("keeps an empty-text line whose background words are timed", () => {
      const ttml = exportLines([
        lineFromFields(
          {
            id: "b",
            text: "",
            agentId: "v1",
            begin: 3,
            end: 4,
            backgroundText: "ooh",
            backgroundWords: [{ id: "w1", text: "ooh", sep: "", begin: 3, end: 3.5, joinsNext: false }],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ]);
      expect(ttml).toContain(">ooh</span>");
    });

    it("exports nothing for a project of only empty lines", () => {
      const ttml = exportLines([
        lineFromFields({ id: "a", text: "", agentId: "v1", begin: 1, end: 2 }, DEFAULT_SPLIT_CHARACTER),
        lineFromFields({ id: "b", text: "", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      ]);
      expect(paragraphs(ttml)).toHaveLength(0);
    });
  });

  describe("invariants", () => {
    it("never writes an empty paragraph whatever mix of lines it gets", () => {
      const ttml = exportLines([
        lineFromFields({ id: "a", text: "", agentId: "v1", begin: 0, end: 1 }, DEFAULT_SPLIT_CHARACTER),
        lineFromFields(
          {
            id: "b",
            text: "one two",
            agentId: "v1",
            words: [
              { id: "w2", text: "one", sep: " ", begin: 1, end: 1.5, joinsNext: false },
              { id: "w3", text: "two", sep: "", begin: 1.5, end: 2, joinsNext: false },
            ],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
        lineFromFields({ id: "c", text: " ", agentId: "v1", begin: 2, end: 3 }, DEFAULT_SPLIT_CHARACTER),
        lineFromFields({ id: "d", text: "", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
      ]);
      expect(ttml).not.toMatch(/<p [^>]*><\/p>/);
      expect(paragraphs(ttml)).toHaveLength(1);
    });
  });
});
