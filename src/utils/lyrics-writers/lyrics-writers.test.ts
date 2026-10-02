import type { Agent } from "@/domain/agent/model";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { createLine } from "@/test/factories";
import { parseLrc } from "@/utils/lyrics-parsers/lrc";
import { parseQrc } from "@/utils/lyrics-parsers/qrc";
import { parseSrt } from "@/utils/lyrics-parsers/srt";
import { writeLrc } from "@/utils/lyrics-writers/lrc";
import { writeQrc } from "@/utils/lyrics-writers/qrc";
import { writeSrt } from "@/utils/lyrics-writers/srt";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const METADATA: ProjectMetadata = { title: "Song", artists: ["Singer", "Guest"], album: "Record", duration: 0 };
const AGENTS: Agent[] = [
  { id: "v1", type: "person", name: "Lead" },
  { id: "v2", type: "person", name: "Duet" },
];

function wordLine(id: string, agentId = "v1"): LyricLine {
  return createLine({
    id,
    agentId,
    text: "Is it so",
    words: [
      { text: "Is ", begin: 34.059, end: 34.189 },
      { text: "it ", begin: 34.189, end: 34.309 },
      { text: "so", begin: 34.309, end: 34.413 },
    ],
  });
}

function lineSynced(text: string, begin: number, end: number, agentId = "v1"): LyricLine {
  return createLine({ text, begin, end, agentId });
}

function doc(lines: LyricLine[], agents: Agent[] = AGENTS) {
  return { metadata: METADATA, agents, lines };
}

// -- LRC ----------------------------------------------------------------------

describe("writeLrc", () => {
  it("writes header tags from the metadata", () => {
    const lrc = writeLrc(doc([lineSynced("Hello", 1, 2)]));

    expect(lrc).toContain("[ti:Song]");
    expect(lrc).toContain("[ar:Singer, Guest]");
    expect(lrc).toContain("[al:Record]");
  });

  it("writes enhanced word tags for a word-synced line, closed by the last word's end", () => {
    expect(writeLrc(doc([wordLine("a")]))).toContain("[00:34.06]<00:34.06>Is <00:34.19>it <00:34.31>so<00:34.41>");
  });

  it("writes plain lines for line-synced lyrics", () => {
    const lrc = writeLrc(doc([lineSynced("Hello", 1, 2), lineSynced("World", 2, 3)]));

    expect(lrc).toContain("[00:01.00]Hello\n[00:02.00]World");
  });

  it("round-trips line timing through the LRC parser", () => {
    const parsed = parseLrc(writeLrc(doc([lineSynced("Hello", 1, 2), lineSynced("World", 5, 7.5)])));

    expect(parsed.lines.map((line) => [line.text, line.begin, line.end])).toEqual([
      ["Hello", 1, 2],
      ["World", 5, 7.5],
    ]);
  });

  it("round-trips word timing through the LRC parser", () => {
    const parsed = parseLrc(writeLrc(doc([wordLine("a")])));

    expect(parsed.lines[0].words?.map((word) => [word.text, word.begin, word.end])).toEqual([
      ["Is ", 34.06, 34.19],
      ["it ", 34.19, 34.31],
      ["so", 34.31, 34.41],
    ]);
  });

  describe("edge cases", () => {
    it("writes nothing but headers for a project with no timed lines", () => {
      expect(writeLrc(doc([createLine({ text: "untimed" })]))).toBe("[ti:Song]\n[ar:Singer, Guest]\n[al:Record]");
    });

    it("omits empty metadata tags", () => {
      const lrc = writeLrc({ metadata: { ...METADATA, title: "", artists: [], album: "" }, agents: AGENTS, lines: [] });

      expect(lrc).toBe("");
    });

    it("writes minutes past ten and rounds to centiseconds", () => {
      expect(writeLrc(doc([lineSynced("Late", 754.996, 760)]))).toContain("[12:35.00]Late");
    });

    it("does not add a gap marker between lines that touch", () => {
      expect(writeLrc(doc([lineSynced("A", 1, 2), lineSynced("B", 2, 3)]))).not.toContain("[00:02.00]\n");
    });
  });

  describe("background vocals", () => {
    it("appends timed background words in parentheses", () => {
      const line = createLine({
        text: "Main",
        words: [{ text: "Main", begin: 1, end: 2 }],
        backgroundText: "oh yeah",
        backgroundWords: [
          { text: "oh ", begin: 2, end: 2.5 },
          { text: "yeah", begin: 2.5, end: 3 },
        ],
      });

      expect(writeLrc(doc([line]))).toContain("[00:01.00]<00:01.00>Main <00:02.00>(oh <00:02.50>yeah)<00:03.00>");
    });

    it("regression: never writes a word tag earlier than the one before it when background overlaps", () => {
      const line = createLine({
        text: "I'm here",
        words: [
          { text: "I'm ", begin: 3, end: 3.5 },
          { text: "here", begin: 3.5, end: 4 },
        ],
        backgroundText: "oh",
        backgroundWords: [{ text: "oh", begin: 3.2, end: 3.8 }],
      });

      const parsed = parseLrc(writeLrc(doc([line])));

      const words = parsed.lines[0].words ?? [];
      expect(words.map((word) => word.text).join("")).toBe("I'm here (oh)");
      for (const word of words) expect(word.end).toBeGreaterThanOrEqual(word.begin);
    });

    it("regression: untimed background text on a word-synced line does not jump back to the line start", () => {
      const line = createLine({
        text: "Main words",
        words: [
          { text: "Main ", begin: 1, end: 2 },
          { text: "words", begin: 2, end: 3 },
        ],
        backgroundText: "oh",
      });

      const words = parseLrc(writeLrc(doc([line]))).lines[0].words ?? [];
      for (const word of words) expect(word.end).toBeGreaterThanOrEqual(word.begin);
    });

    it("keeps parentheses the background text already carries", () => {
      const line = createLine({ text: "Main", begin: 1, end: 2, backgroundText: "(oh)" });

      expect(writeLrc(doc([line]))).toContain("[00:01.00]Main (oh)");
    });
  });
});

// -- SRT ----------------------------------------------------------------------

describe("writeSrt", () => {
  it("writes numbered cues with comma millisecond timestamps", () => {
    expect(writeSrt(doc([lineSynced("Hello", 1, 2.5), lineSynced("World", 3661.007, 3662)]))).toBe(
      "1\n00:00:01,000 --> 00:00:02,500\nHello\n\n2\n01:01:01,007 --> 01:01:02,000\nWorld\n",
    );
  });

  it("joins word-synced words into one cue spanning the words", () => {
    expect(writeSrt(doc([wordLine("a")]))).toBe("1\n00:00:34,059 --> 00:00:34,413\nIs it so\n");
  });

  it("round-trips through the SRT parser", () => {
    const parsed = parseSrt(writeSrt(doc([lineSynced("Hello", 1, 2.5), wordLine("a")])));

    expect(parsed.lines.map((line) => [line.text, line.begin, line.end])).toEqual([
      ["Hello", 1, 2.5],
      ["Is it so", 34.059, 34.413],
    ]);
  });

  describe("edge cases", () => {
    it("writes an empty document for a project with no timed lines", () => {
      expect(writeSrt(doc([createLine({ text: "untimed" })]))).toBe("");
    });

    it("includes background text after the main text", () => {
      const line = createLine({ text: "Main", begin: 1, end: 2, backgroundText: "oh" });

      expect(writeSrt(doc([line]))).toContain("\nMain (oh)\n");
    });
  });
});

// -- QRC ----------------------------------------------------------------------

describe("writeQrc", () => {
  it("writes a line header and trailing word tags in milliseconds", () => {
    expect(writeQrc(doc([wordLine("a")]))).toContain("[34059,354]Is (34059,130)it (34189,120)so(34309,104)");
  });

  it("writes a line-synced line as a header with plain text", () => {
    expect(writeQrc(doc([lineSynced("Hello", 1, 2.5)]))).toContain("[1000,1500]Hello");
  });

  it("writes header tags from the metadata", () => {
    const qrc = writeQrc(doc([lineSynced("Hello", 1, 2)]));

    expect(qrc).toContain("[ti:Song]");
    expect(qrc).toContain("[ar:Singer, Guest]");
    expect(qrc).toContain("[al:Record]");
  });

  it("round-trips word timing through the QRC parser", () => {
    const parsed = parseQrc(writeQrc(doc([wordLine("a")])));

    expect(parsed.lines[0].words?.map((word) => [word.text, word.begin, word.end])).toEqual([
      ["Is ", 34.059, 34.189],
      ["it ", 34.189, 34.309],
      ["so", 34.309, 34.413],
    ]);
  });

  describe("singers", () => {
    it("writes no singer markers for a single voice", () => {
      expect(writeQrc(doc([lineSynced("A", 1, 2), lineSynced("B", 2, 3)]))).not.toContain("：");
    });

    it("writes a singer marker at every change of voice and round-trips the split", () => {
      const qrc = writeQrc(
        doc([lineSynced("A", 1, 2, "v1"), lineSynced("B", 2, 3, "v1"), lineSynced("C", 3, 4, "v2")]),
      );

      expect(qrc).toContain("[1000,0]Lead：\n[1000,1000]A\n[2000,1000]B\n[3000,0]Duet：\n[3000,1000]C");
      const parsed = parseQrc(qrc);
      expect(parsed.agents?.map((agent) => agent.name)).toEqual(["Lead", "Duet"]);
      expect(parsed.lines.map((line) => line.agentId)).toEqual(["v1", "v1", "v2"]);
    });

    it("writes a combined voice with the slash QQ uses", () => {
      const agents: Agent[] = [...AGENTS, { id: "v3", type: "group", name: "Lead, Duet" }];
      const qrc = writeQrc(doc([lineSynced("A", 1, 2, "v1"), lineSynced("B", 2, 3, "v3")], agents));

      expect(qrc).toContain("[2000,0]Lead/Duet：");
    });

    it("falls back to the agent id when the name cannot be a marker", () => {
      const agents: Agent[] = [
        { id: "v1", type: "person", name: "" },
        { id: "v2", type: "person", name: "Hey!" },
      ];
      const qrc = writeQrc(doc([lineSynced("A", 1, 2, "v1"), lineSynced("B", 2, 3, "v2")], agents));

      expect(qrc).toContain("[1000,0]v1：");
      expect(qrc).toContain("[2000,0]v2：");
    });
  });

  describe("edge cases", () => {
    it("writes nothing for an empty project with no metadata", () => {
      expect(
        writeQrc({ metadata: { ...METADATA, title: "", artists: [], album: "" }, agents: AGENTS, lines: [] }),
      ).toBe("");
    });

    it("parenthesizes background words and keeps their timing", () => {
      const line = createLine({
        text: "Main",
        words: [{ text: "Main", begin: 1, end: 2 }],
        backgroundText: "oh",
        backgroundWords: [{ text: "oh", begin: 2, end: 2.5 }],
      });

      expect(writeQrc(doc([line]))).toContain("[1000,1500]Main (1000,1000)(oh)(2000,500)");
    });
  });
});

// -- Invariants ---------------------------------------------------------------

describe("invariants", () => {
  it("never mutates the input lines", () => {
    const lines = [wordLine("a"), lineSynced("B", 40, 41)];
    const snapshot = structuredClone(lines);

    writeLrc(doc(lines));
    writeSrt(doc(lines));
    writeQrc(doc(lines));

    expect(lines).toEqual(snapshot);
  });
});
