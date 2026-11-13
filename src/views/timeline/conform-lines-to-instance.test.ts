/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import type { LineTemplate } from "@/domain/group/template";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";
import { conformLinesToInstance } from "@/views/timeline/conform-lines-to-instance";

// -- Fixtures -----------------------------------------------------------------

const chorusTemplate: LineTemplate[] = [
  {
    text: "We were dancing in the dark",
    agentId: "v1",
    relativeBegin: 0,
    relativeEnd: 2,
    words: [
      { text: "We were", sep: " ", relativeBegin: 0, relativeEnd: 0.8, joinsNext: false },
      { text: "dancing in the dark", sep: "", relativeBegin: 0.8, relativeEnd: 2, joinsNext: false },
    ],
  },
  {
    text: "Till the morning came",
    agentId: "v2",
    relativeBegin: 2.5,
    relativeEnd: 4,
    words: [{ text: "Till the morning came", sep: "", relativeBegin: 2.5, relativeEnd: 4, joinsNext: false }],
  },
];

function songWithLooseChorus(): LyricLine[] {
  return [
    lineFromFields({
      id: "verse",
      text: "I remember",
      agentId: "v1",
      words: [{ id: "w1", text: "I remember", sep: "", begin: 0, end: 4, joinsNext: false }],
    }),
    lineFromFields({
      id: "loose1",
      text: "we were dancin in the dark",
      agentId: "v1",
      words: [{ id: "w2", text: "we were dancin in the dark", sep: "", begin: 20, end: 22, joinsNext: false }],
    }),
    lineFromFields({
      id: "loose2",
      text: "till mornin came",
      agentId: "v1",
      words: [{ id: "w3", text: "till mornin came", sep: "", begin: 22.4, end: 24, joinsNext: false }],
    }),
    lineFromFields({
      id: "outro",
      text: "Goodnight",
      agentId: "v1",
      words: [{ id: "w4", text: "Goodnight", sep: "", begin: 30, end: 32, joinsNext: false }],
    }),
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
    expect(lineText(updated[1])).toBe("We were dancing in the dark");
    expect(lineText(updated[2])).toBe("Till the morning came");
    expect(mainTrack(updated[2]).agentId).toBe("v2");
    expect(updated[1].id).toBe("loose1");
    expect(updated[2].id).toBe("loose2");
  });

  it("takes the lowest unused instanceIdx", () => {
    const lines: LyricLine[] = [
      lineFromFields({ id: "c0l1", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
      lineFromFields({ id: "c0l2", text: "b", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 }),
      lineFromFields({ id: "c2l1", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 2, templateLineIdx: 0 }),
      lineFromFields({ id: "c2l2", text: "b", agentId: "v1", groupId: "g1", instanceIdx: 2, templateLineIdx: 1 }),
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

    expect(timedSyllables(mainTrack(result.updatedLines![1]))[0].begin).toBe(20);
    expect(timedSyllables(mainTrack(result.updatedLines![1]))[1].end).toBe(22);
    expect(timedSyllables(mainTrack(result.updatedLines![2]))[0].begin).toBe(22.5);
    expect(timedSyllables(mainTrack(result.updatedLines![2]))[0].end).toBe(24);
  });

  it("falls back to the playhead when the selected lines carry no timing", () => {
    const lines: LyricLine[] = [
      lineFromFields({ id: "loose1", text: "we were dancin in the dark", agentId: "v1" }),
      lineFromFields({ id: "loose2", text: "till mornin came", agentId: "v1" }),
    ];
    const result = conformLinesToInstance({
      lines,
      groupId: "g1",
      template: chorusTemplate,
      selectedLineIds: looseIds,
      playheadTime: 42,
    });

    expect(timedSyllables(mainTrack(result.updatedLines![0]))[0].begin).toBe(42);
    expect(timedSyllables(mainTrack(result.updatedLines![1]))[0].end).toBe(46);
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
