/**
 * @vitest-environment node
 */
import type { LinkGroup, LyricLine } from "@/stores/project";
import { describe, expect, it } from "vitest";
import {
  createGroupFromSelection,
  instanceLineRange,
  instanceToTemplate,
  lineIdsAreContiguous,
  selectionTouchesAnyGroup,
} from "./group-ops";

const lines = (overrides: Partial<LyricLine>[]): LyricLine[] =>
  overrides.map((o, i) => ({ id: `l${i}`, text: `t${i}`, agentId: "v1", ...o }));

describe("lineIdsAreContiguous", () => {
  it("true when selection is consecutive", () => {
    const ls = lines([{}, {}, {}, {}]);
    expect(lineIdsAreContiguous(ls, new Set(["l1", "l2"]))).toBe(true);
  });

  it("false when selection has a gap", () => {
    const ls = lines([{}, {}, {}, {}]);
    expect(lineIdsAreContiguous(ls, new Set(["l0", "l2"]))).toBe(false);
  });

  it("false on empty selection", () => {
    expect(lineIdsAreContiguous(lines([{}]), new Set())).toBe(false);
  });
});

describe("createGroupFromSelection", () => {
  it("creates a new group with sequential templateLineIdx", () => {
    const ls = lines([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const result = createGroupFromSelection(ls, new Set(["a", "b"]), []);
    expect(result).not.toBeNull();
    expect(result?.group.label).toMatch(/Group/);
    expect(result?.updatedLines.find((l) => l.id === "a")?.templateLineIdx).toBe(0);
    expect(result?.updatedLines.find((l) => l.id === "b")?.templateLineIdx).toBe(1);
    expect(result?.updatedLines.find((l) => l.id === "c")?.groupId).toBeUndefined();
  });

  it("rejects non-contiguous selection", () => {
    const ls = lines([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const result = createGroupFromSelection(ls, new Set(["a", "c"]), []);
    expect(result).toBeNull();
  });

  it("rejects selection overlapping existing groups", () => {
    const ls = lines([{ id: "a", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }, { id: "b" }]);
    expect(selectionTouchesAnyGroup(ls, new Set(["a"]))).toBe(true);
    expect(createGroupFromSelection(ls, new Set(["a", "b"]), [])).toBeNull();
  });
});

describe("instanceToTemplate", () => {
  it("converts an instance's lines into relative-offset templates", () => {
    const ls: LyricLine[] = [
      {
        id: "a",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        begin: 30,
        end: 32,
        words: [
          { text: "I ", begin: 30, end: 30.4 },
          { text: "love ", begin: 30.4, end: 30.9 },
          { text: "you", begin: 30.9, end: 32 },
        ],
      },
      {
        id: "b",
        text: "yeah",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 1,
        begin: 32,
        end: 33,
        words: [{ text: "yeah", begin: 32, end: 33 }],
      },
    ];

    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl).toHaveLength(2);
    expect(tpl[0].relativeBegin).toBeCloseTo(0);
    expect(tpl[0].relativeEnd).toBeCloseTo(2);
    expect(tpl[0].words?.[2].relativeEnd).toBeCloseTo(2);
    expect(tpl[1].relativeBegin).toBeCloseTo(2);
    expect(tpl[1].words?.[0].relativeEnd).toBeCloseTo(3);
  });

  it("uses min word begin as the start anchor", () => {
    const ls: LyricLine[] = [
      {
        id: "a",
        text: "hi",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        backgroundWords: [{ text: "yeah", begin: 28, end: 29 }],
        words: [{ text: "hi", begin: 30, end: 31 }],
      },
    ];
    const range = instanceLineRange(ls, "g1", 0);
    expect(range.startTime).toBe(28);
  });
});

describe("createGroupFromSelection · group color", () => {
  it("picks an unused color from the palette", () => {
    const existing: LinkGroup[] = [{ id: "g1", label: "x", color: "#f472b6", templateVersion: 1 }];
    const ls = lines([{ id: "a" }]);
    const result = createGroupFromSelection(ls, new Set(["a"]), existing);
    expect(result?.group.color).not.toBe("#f472b6");
  });
});

// -- instanceLineRange · stale line.begin/end ignored when words present -------

describe("instanceLineRange · prefers word-level timing over stale line.begin/end", () => {
  it("ignores stale line.begin/end when words are present (matches instanceBounds)", () => {
    const ls: LyricLine[] = [
      {
        id: "L1",
        text: "x",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        // Stale line-level (e.g. from TTML import populating both)
        begin: 100,
        end: 200,
        words: [
          { text: "hello", begin: 5, end: 6 },
          { text: "world", begin: 6, end: 7 },
        ],
      },
    ];
    const range = instanceLineRange(ls, "g1", 0);
    expect(range.startTime).toBe(5);
    expect(range.endTime).toBe(7);
  });

  it("uses bg words when no main words", () => {
    const ls: LyricLine[] = [
      {
        id: "L1",
        text: "x",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        begin: 100,
        end: 200,
        backgroundWords: [{ text: "ah", begin: 5, end: 6 }],
      },
    ];
    const range = instanceLineRange(ls, "g1", 0);
    expect(range.startTime).toBe(5);
    expect(range.endTime).toBe(6);
  });

  it("falls back to line.begin/end ONLY when truly line-synced (no words)", () => {
    const ls: LyricLine[] = [
      { id: "L1", text: "x", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0, begin: 5, end: 7 },
    ];
    const range = instanceLineRange(ls, "g1", 0);
    expect(range.startTime).toBe(5);
    expect(range.endTime).toBe(7);
  });

  it("instanceToTemplate uses word-derived startTime as the relative-offset anchor", () => {
    // Regression for the would-corrupt scenario: if instanceLineRange returned
    // a stale line.begin (smaller than real word begin), every relativeBegin
    // in the produced template would be inflated, and pasting the template
    // later would mis-position the new instance.
    const ls: LyricLine[] = [
      {
        id: "L1",
        text: "x",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        // Stale earlier line.begin
        begin: 1,
        end: 8,
        words: [
          { text: "hello ", begin: 5, end: 6 },
          { text: "world", begin: 6, end: 7 },
        ],
      },
    ];
    const template = instanceToTemplate(ls, "g1", 0);
    expect(template).toHaveLength(1);
    // Anchor is 5 (first word begin), so first word's relativeBegin is 0
    expect(template[0].words?.[0].relativeBegin).toBeCloseTo(0);
    expect(template[0].words?.[1].relativeEnd).toBeCloseTo(2);
  });
});
