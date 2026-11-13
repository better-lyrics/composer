/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import type { LineTemplate } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { fillEmptyLinesWithInstance, isEmptyFillable } from "./fill-empty-lines-with-instance";

const template: LineTemplate[] = [
  {
    text: "Chorus line 1",
    agentId: "v1",
    relativeBegin: 0,
    relativeEnd: 1,
    words: [{ text: "Chorus line 1", sep: "", relativeBegin: 0, relativeEnd: 1 }],
  },
  {
    text: "Chorus line 2",
    agentId: "v1",
    relativeBegin: 1,
    relativeEnd: 2,
    words: [{ text: "Chorus line 2", sep: "", relativeBegin: 1, relativeEnd: 2 }],
  },
];

describe("isEmptyFillable", () => {
  it("returns true for a line with no words and no group", () => {
    expect(isEmptyFillable({ id: "1", text: "anything", agentId: "v1" })).toBe(true);
  });

  it("returns true for a line with empty words array and no group", () => {
    expect(isEmptyFillable({ id: "1", text: "x", agentId: "v1", words: [] })).toBe(true);
  });

  it("returns false for a line that has words", () => {
    expect(
      isEmptyFillable({
        id: "1",
        text: "x",
        agentId: "v1",
        words: [{ id: "w1", text: "x", sep: "", begin: 0, end: 1 }],
      }),
    ).toBe(false);
  });

  it("returns false for a line that belongs to a group", () => {
    expect(
      isEmptyFillable({
        id: "1",
        text: "x",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
      }),
    ).toBe(false);
  });
});

describe("fillEmptyLinesWithInstance · happy path", () => {
  it("fills exactly N consecutive empty lines and assigns group attrs", () => {
    const lines: LyricLine[] = [
      { id: "intro", text: "intro", agentId: "v1", words: [{ id: "w2", text: "intro", sep: "", begin: 0, end: 5 }] },
      { id: "empty1", text: "Chorus line 1", agentId: "v1" },
      { id: "empty2", text: "Chorus line 2", agentId: "v1" },
      { id: "outro", text: "outro", agentId: "v1", words: [{ id: "w3", text: "outro", sep: "", begin: 30, end: 35 }] },
    ];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: 1,
      instanceStart: 10,
    });
    expect(result.ok).toBe(true);
    expect(result.updatedLines).toHaveLength(4);
    expect(result.updatedLines?.[1].groupId).toBe("g1");
    expect(result.updatedLines?.[1].instanceIdx).toBe(0);
    expect(result.updatedLines?.[1].templateLineIdx).toBe(0);
    expect(timedSyllables(mainTrack(result.updatedLines![1]))[0].begin).toBe(10);
    expect(result.updatedLines?.[2].templateLineIdx).toBe(1);
    expect(timedSyllables(mainTrack(result.updatedLines![2]))[0].begin).toBe(11);
    expect(result.updatedLines?.[0].id).toBe("intro");
    expect(result.updatedLines?.[3].id).toBe("outro");
  });

  it("preserves the original line ids (in-place fill, not replacement)", () => {
    const lines: LyricLine[] = [
      { id: "L_a", text: "anything", agentId: "v1" },
      { id: "L_b", text: "anything else", agentId: "v1" },
    ];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: 0,
      instanceStart: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.updatedLines?.[0].id).toBe("L_a");
    expect(result.updatedLines?.[1].id).toBe("L_b");
  });

  it("overwrites the line text to match the template (linked instances must match)", () => {
    const lines: LyricLine[] = [
      { id: "L_a", text: "user typed something else", agentId: "v1" },
      { id: "L_b", text: "and something different", agentId: "v1" },
    ];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: 0,
      instanceStart: 0,
    });
    expect(result.ok).toBe(true);
    expect(lineText(result.updatedLines![0])).toBe("Chorus line 1");
    expect(lineText(result.updatedLines![1])).toBe("Chorus line 2");
  });

  it("picks the next available instanceIdx for the group", () => {
    const lines: LyricLine[] = [
      { id: "existing1", text: "x", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      { id: "existing2", text: "y", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
      { id: "empty1", text: "Chorus line 1", agentId: "v1" },
      { id: "empty2", text: "Chorus line 2", agentId: "v1" },
    ];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: 2,
      instanceStart: 10,
    });
    expect(result.ok).toBe(true);
    expect(result.instanceIdx).toBe(1);
    expect(result.updatedLines?.[2].instanceIdx).toBe(1);
  });
});

describe("fillEmptyLinesWithInstance · background provenance", () => {
  const bgTemplate: LineTemplate[] = [
    {
      text: "Chorus line 1",
      agentId: "v1",
      relativeBegin: 0,
      relativeEnd: 1,
      words: [{ text: "Chorus line 1", sep: "", relativeBegin: 0, relativeEnd: 1 }],
      backgroundText: "ooh",
      backgroundWords: [{ text: "ooh", sep: "", relativeBegin: 0, relativeEnd: 0.5 }],
      backgroundTextSource: "extraction",
    },
  ];

  it("carries backgroundTextSource from the template onto the filled line", () => {
    const lines: LyricLine[] = [{ id: "empty1", text: "anything", agentId: "v1" }];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template: bgTemplate,
      startIndex: 0,
      instanceStart: 10,
    });
    expect(result.ok).toBe(true);
    expect(backgroundText(result.updatedLines![0])).toBe("ooh");
    expect(timedSyllables(backgroundTrack(result.updatedLines![0]))[0].begin).toBe(10);
    expect(backgroundTrack(result.updatedLines![0])?.source).toBe("extraction");
  });

  it("carries a manual-sourced flag from the template", () => {
    const manualTemplate: LineTemplate[] = [
      {
        text: "Chorus line 1",
        agentId: "v1",
        backgroundText: "ooh",
        backgroundTextSource: "manual",
      },
    ];
    const lines: LyricLine[] = [{ id: "empty1", text: "anything", agentId: "v1" }];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template: manualTemplate,
      startIndex: 0,
      instanceStart: 0,
    });
    expect(backgroundTrack(result.updatedLines![0])?.source).toBe("manual");
  });

  it("leaves backgroundTextSource undefined when the template has no background", () => {
    const lines: LyricLine[] = [
      { id: "empty1", text: "a", agentId: "v1" },
      { id: "empty2", text: "b", agentId: "v1" },
    ];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: 0,
      instanceStart: 0,
    });
    expect(result.updatedLines?.[0].backgroundTextSource).toBeUndefined();
  });
});

describe("fillEmptyLinesWithInstance · refusal cases (no destructive insert)", () => {
  it("refuses when one of the target rows already has words", () => {
    const lines: LyricLine[] = [
      { id: "empty1", text: "Chorus line 1", agentId: "v1" },
      {
        id: "synced",
        text: "Chorus line 2",
        agentId: "v1",
        words: [{ id: "w4", text: "Chorus line 2", sep: "", begin: 0, end: 1 }],
      },
    ];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: 0,
      instanceStart: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_enough_empty_lines");
    expect(result.updatedLines).toBeUndefined();
  });

  it("refuses when one of the target rows already belongs to a group", () => {
    const lines: LyricLine[] = [
      { id: "empty1", text: "Chorus line 1", agentId: "v1" },
      {
        id: "grouped",
        text: "Chorus line 2",
        agentId: "v1",
        groupId: "other",
        instanceIdx: 0,
        templateLineIdx: 0,
      },
    ];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: 0,
      instanceStart: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_enough_empty_lines");
  });

  it("refuses when the destination range extends past the end of the project", () => {
    const lines: LyricLine[] = [{ id: "empty1", text: "Chorus line 1", agentId: "v1" }];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: 0,
      instanceStart: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("out_of_range");
  });

  it("refuses when startIndex is negative", () => {
    const lines: LyricLine[] = [
      { id: "empty1", text: "x", agentId: "v1" },
      { id: "empty2", text: "y", agentId: "v1" },
    ];
    const result = fillEmptyLinesWithInstance({
      lines,
      groupId: "g1",
      template,
      startIndex: -1,
      instanceStart: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("out_of_range");
  });
});
