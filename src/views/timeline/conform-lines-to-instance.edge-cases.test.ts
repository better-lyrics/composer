/**
 * @vitest-environment node
 */
import type { LineTemplate } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { conformLinesToInstance } from "@/views/timeline/conform-lines-to-instance";
import { fillEmptyLinesWithInstance } from "@/views/timeline/fill-empty-lines-with-instance";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const twoLineTemplate: LineTemplate[] = [
  {
    text: "We were dancing in the dark",
    agentId: "v1",
    relativeBegin: 0,
    relativeEnd: 2,
    words: [{ text: "We were dancing in the dark", relativeBegin: 0, relativeEnd: 2 }],
  },
  {
    text: "Till the morning came",
    agentId: "v1",
    relativeBegin: 2.5,
    relativeEnd: 4,
    words: [{ text: "Till the morning came", relativeBegin: 2.5, relativeEnd: 4 }],
  },
];

function looseChorus(): LyricLine[] {
  return [
    {
      id: "loose1",
      text: "we were dancin in the dark",
      agentId: "v1",
      words: [{ text: "we were dancin in the dark", begin: 20, end: 22 }],
    },
    {
      id: "loose2",
      text: "till mornin came",
      agentId: "v1",
      words: [{ text: "till mornin came", begin: 22.4, end: 24 }],
    },
  ];
}

const looseIds: ReadonlySet<string> = new Set(["loose1", "loose2"]);

// -- Edge cases ---------------------------------------------------------------

describe("conformLinesToInstance · edge cases", () => {
  it("conforms a single line to a single-line template", () => {
    const lines: LyricLine[] = [
      { id: "hook", text: "oh oh oh", agentId: "v1", words: [{ text: "oh oh oh", begin: 8, end: 9 }] },
    ];
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: [
        {
          text: "Oh oh oh",
          agentId: "v1",
          relativeBegin: 0,
          relativeEnd: 1.5,
          words: [{ text: "Oh oh oh", relativeBegin: 0, relativeEnd: 1.5 }],
        },
      ],
      selectedLineIds: new Set(["hook"]),
      playheadTime: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.updatedLines?.[0].text).toBe("Oh oh oh");
    expect(result.updatedLines?.[0].words?.[0].begin).toBe(8);
    expect(result.updatedLines?.[0].words?.[0].end).toBe(9.5);
  });

  it("keeps a line-synced template line-synced, with no words array", () => {
    const result = conformLinesToInstance({
      lines: looseChorus(),
      groupId: "g1",
      template: [
        { text: "We were dancing in the dark", agentId: "v1", relativeBegin: 0, relativeEnd: 2 },
        { text: "Till the morning came", agentId: "v1", relativeBegin: 2.5, relativeEnd: 4 },
      ],
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.updatedLines?.[0].words).toBeUndefined();
    expect(result.updatedLines?.[0].begin).toBe(20);
    expect(result.updatedLines?.[0].end).toBe(22);
    expect(result.updatedLines?.[1].begin).toBe(22.5);
    expect(result.updatedLines?.[1].end).toBe(24);
  });

  it("carries background vocals from the template onto the conformed lines", () => {
    const bgTemplate: LineTemplate[] = [
      {
        text: "We were dancing in the dark",
        agentId: "v1",
        relativeBegin: 0,
        relativeEnd: 2,
        words: [{ text: "We were dancing in the dark", relativeBegin: 0, relativeEnd: 2 }],
        backgroundText: "in the dark",
        backgroundWords: [
          { text: "in ", relativeBegin: 1.2, relativeEnd: 1.5 },
          { text: "the dark", relativeBegin: 1.5, relativeEnd: 2 },
        ],
        backgroundTextSource: "extraction",
      },
      {
        text: "Till the morning came",
        agentId: "v1",
        relativeBegin: 2.5,
        relativeEnd: 4,
        words: [{ text: "Till the morning came", relativeBegin: 2.5, relativeEnd: 4 }],
      },
    ];
    const result = conformLinesToInstance({
      lines: looseChorus(),
      groupId: "g1",
      template: bgTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.ok).toBe(true);
    const first = result.updatedLines?.[0];
    expect(first?.backgroundText).toBe("in the dark");
    expect(first?.backgroundWords?.map((w) => w.text)).toEqual(["in ", "the dark"]);
    expect(first?.backgroundWords?.[0].begin).toBe(21.2);
    expect(first?.backgroundWords?.[1].end).toBe(22);
    expect(first?.backgroundTextSource).toBe("extraction");
    expect(result.updatedLines?.[1].backgroundText).toBeUndefined();
    expect(result.updatedLines?.[1].backgroundWords).toBeUndefined();
  });

  it("clears background vocals the selection had but the template does not", () => {
    const lines: LyricLine[] = looseChorus().map((line, idx) =>
      idx === 0
        ? {
            ...line,
            backgroundText: "ooh",
            backgroundWords: [{ text: "ooh", begin: 21, end: 21.5 }],
            backgroundTextSource: "manual" as const,
          }
        : line,
    );
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: twoLineTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.updatedLines?.[0].backgroundText).toBeUndefined();
    expect(result.updatedLines?.[0].backgroundWords).toBeUndefined();
    expect(result.updatedLines?.[0].backgroundTextSource).toBeUndefined();
  });

  it("uses background timing when it starts before the main words", () => {
    const lines: LyricLine[] = looseChorus().map((line, idx) =>
      idx === 0 ? { ...line, backgroundText: "ooh", backgroundWords: [{ text: "ooh", begin: 18, end: 19 }] } : line,
    );
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: twoLineTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.updatedLines?.[0].words?.[0].begin).toBe(18);
  });

  it("conforms a selection at the very start of the project", () => {
    const lines: LyricLine[] = [
      ...looseChorus(),
      { id: "outro", text: "Goodnight", agentId: "v1", words: [{ text: "Goodnight", begin: 30, end: 32 }] },
    ];
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: twoLineTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.updatedLines?.[0].templateLineIdx).toBe(0);
    expect(result.updatedLines?.[2].groupId).toBeUndefined();
  });

  it("conforms a selection at the very end of the project", () => {
    const lines: LyricLine[] = [
      { id: "verse", text: "I remember", agentId: "v1", words: [{ text: "I remember", begin: 0, end: 4 }] },
      ...looseChorus(),
    ];
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: twoLineTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.updatedLines?.[2].templateLineIdx).toBe(1);
    expect(result.updatedLines?.[0].groupId).toBeUndefined();
  });
});

// -- Invariants ---------------------------------------------------------------

describe("conformLinesToInstance · invariants", () => {
  it("does not modify the input lines array", () => {
    const lines = looseChorus();
    const snapshot = structuredClone(lines);
    conformLinesToInstance({
      lines,
      groupId: "g1",
      template: twoLineTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(lines).toEqual(snapshot);
  });

  it("keeps every line outside the selection referentially identical", () => {
    const lines: LyricLine[] = [
      { id: "verse", text: "I remember", agentId: "v1", words: [{ text: "I remember", begin: 0, end: 4 }] },
      ...looseChorus(),
      { id: "outro", text: "Goodnight", agentId: "v1", words: [{ text: "Goodnight", begin: 30, end: 32 }] },
    ];
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: twoLineTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.updatedLines?.[0]).toBe(lines[0]);
    expect(result.updatedLines?.[3]).toBe(lines[3]);
    expect(result.updatedLines?.[1]).not.toBe(lines[1]);
  });

  it("matches fillEmptyLinesWithInstance when the targets happen to be empty", () => {
    const lines: LyricLine[] = [
      { id: "verse", text: "I remember", agentId: "v1", words: [{ text: "I remember", begin: 0, end: 4 }] },
      { id: "loose1", text: "", agentId: "v1" },
      { id: "loose2", text: "", agentId: "v1" },
    ];
    const conformed = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: twoLineTemplate,
      selectedLineIds: looseIds,
      playheadTime: 12,
    });
    const filled = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template: twoLineTemplate,
      startIndex: 1,
      instanceStart: 12,
    });

    expect(conformed.ok).toBe(true);
    expect(filled.ok).toBe(true);
    expect(conformed.updatedLines).toEqual(filled.updatedLines);
    expect(conformed.instanceIdx).toBe(filled.instanceIdx);
  });
});
