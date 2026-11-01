/**
 * @vitest-environment node
 */
import type { LineTemplate } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { conformLinesToInstance } from "@/views/timeline/conform-lines-to-instance";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const chorusTemplate: LineTemplate[] = [
  {
    text: "We were dancing in the dark",
    agentId: "v1",
    relativeBegin: 0,
    relativeEnd: 2,
    words: [
      { text: "We were ", relativeBegin: 0, relativeEnd: 0.8 },
      { text: "dancing in the dark", relativeBegin: 0.8, relativeEnd: 2 },
    ],
  },
  {
    text: "Till the morning came",
    agentId: "v2",
    relativeBegin: 2.5,
    relativeEnd: 4,
    words: [{ text: "Till the morning came", relativeBegin: 2.5, relativeEnd: 4 }],
  },
];

function songWithLooseChorus(): LyricLine[] {
  return [
    { id: "verse", text: "I remember", agentId: "v1", words: [{ text: "I remember", begin: 0, end: 4 }] },
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
    { id: "outro", text: "Goodnight", agentId: "v1", words: [{ text: "Goodnight", begin: 30, end: 32 }] },
  ];
}

const looseIds: ReadonlySet<string> = new Set(["loose1", "loose2"]);

// -- Happy paths --------------------------------------------------------------

describe("conformLinesToInstance · happy path", () => {
  it("turns a contiguous run of ungrouped lines into a new instance of the group", () => {
    const lines = songWithLooseChorus();
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.ok).toBe(true);
    const updated = result.updatedLines ?? [];
    expect(updated[1].groupId).toBe("g1");
    expect(updated[2].groupId).toBe("g1");
    expect(updated[1].text).toBe("We were dancing in the dark");
    expect(updated[2].text).toBe("Till the morning came");
    expect(updated[2].agentId).toBe("v2");
    expect(updated[1].id).toBe("loose1");
    expect(updated[2].id).toBe("loose2");
  });

  it("takes the lowest unused instanceIdx", () => {
    const lines: LyricLine[] = [
      { id: "c0l1", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      { id: "c0l2", text: "b", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
      { id: "c2l1", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 2, templateLineIdx: 0 },
      { id: "c2l2", text: "b", agentId: "v1", groupId: "g1", instanceIdx: 2, templateLineIdx: 1 },
      ...songWithLooseChorus().slice(1, 3),
    ];
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.instanceIdx).toBe(1);
    expect(result.updatedLines?.[4].instanceIdx).toBe(1);
    expect(result.updatedLines?.[5].instanceIdx).toBe(1);
  });

  it("numbers templateLineIdx sequentially from zero", () => {
    const result = conformLinesToInstance({
      lines: songWithLooseChorus(),
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.updatedLines?.[1].templateLineIdx).toBe(0);
    expect(result.updatedLines?.[2].templateLineIdx).toBe(1);
  });

  it("offsets template timings by the run's own start time, not the playhead", () => {
    const result = conformLinesToInstance({
      lines: songWithLooseChorus(),
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: looseIds,
      playheadTime: 99,
    });

    expect(result.updatedLines?.[1].words?.[0].begin).toBe(20);
    expect(result.updatedLines?.[1].words?.[1].end).toBe(22);
    expect(result.updatedLines?.[2].words?.[0].begin).toBe(22.5);
    expect(result.updatedLines?.[2].words?.[0].end).toBe(24);
  });

  it("falls back to the playhead when the selected lines carry no timing", () => {
    const lines: LyricLine[] = [
      { id: "loose1", text: "we were dancin in the dark", agentId: "v1" },
      { id: "loose2", text: "till mornin came", agentId: "v1" },
    ];
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: looseIds,
      playheadTime: 42,
    });

    expect(result.updatedLines?.[0].words?.[0].begin).toBe(42);
    expect(result.updatedLines?.[1].words?.[0].end).toBe(46);
  });
});

// -- Rejections ---------------------------------------------------------------

describe("conformLinesToInstance · rejections", () => {
  it("refuses when the selection length differs from the template length", () => {
    const result = conformLinesToInstance({
      lines: songWithLooseChorus(),
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: new Set(["loose1"]),
      playheadTime: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("length_mismatch");
    expect(result.updatedLines).toBeUndefined();
  });

  it("refuses when the selection is not contiguous", () => {
    const result = conformLinesToInstance({
      lines: songWithLooseChorus(),
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: new Set(["verse", "loose2"]),
      playheadTime: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_contiguous");
  });

  it("refuses when a selected line already belongs to a group", () => {
    const lines = songWithLooseChorus();
    lines[2] = { ...lines[2], groupId: "g2", instanceIdx: 0, templateLineIdx: 0 };
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("already_grouped");
  });

  it("refuses when the target group has no derivable template", () => {
    const result = conformLinesToInstance({
      lines: songWithLooseChorus(),
      groupId: "g1",
      template: [],
      selectedLineIds: looseIds,
      playheadTime: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_template");
  });

  it("reports the grouped selection ahead of any shape problem", () => {
    const lines = songWithLooseChorus();
    lines[2] = { ...lines[2], groupId: "g2", instanceIdx: 0, templateLineIdx: 0 };
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: new Set(["verse", "loose2"]),
      playheadTime: 0,
    });

    expect(result.reason).toBe("already_grouped");
  });

  it("refuses an empty selection", () => {
    const result = conformLinesToInstance({
      lines: songWithLooseChorus(),
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: new Set<string>(),
      playheadTime: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("empty_selection");
  });

  it("refuses when a selected id is not present in the lines", () => {
    const result = conformLinesToInstance({
      lines: songWithLooseChorus(),
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: new Set(["loose1", "ghost"]),
      playheadTime: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unknown_line");
  });

  it("distinguishes a gap in the selection from an id it cannot find", () => {
    const gapped = conformLinesToInstance({
      lines: songWithLooseChorus(),
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: new Set(["verse", "loose2"]),
      playheadTime: 0,
    });

    expect(gapped.reason).toBe("not_contiguous");
  });
});
