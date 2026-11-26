/**
 * @vitest-environment node
 */
import { type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import {
  createGroupFromSelection,
  instanceToTemplate,
  lineIdsAreContiguous,
  selectionTouchesAnyGroup,
} from "./group-ops";

const lines = (overrides: Partial<LineFields>[]): LyricLine[] =>
  overrides.map((o, i) => lineFromFields({ id: `l${i}`, text: `t${i}`, agentId: "v1", ...o }));

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
    const result = createGroupFromSelection(ls, new Set(["a", "b"]), [], false);
    expect(result).not.toBeNull();
    expect(result?.group.label).toMatch(/Group/);
    expect(result?.updatedLines.find((l) => l.id === "a")?.templateLineIdx).toBe(0);
    expect(result?.updatedLines.find((l) => l.id === "b")?.templateLineIdx).toBe(1);
    expect(result?.updatedLines.find((l) => l.id === "c")?.groupId).toBeUndefined();
  });

  it("rejects non-contiguous selection", () => {
    const ls = lines([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const result = createGroupFromSelection(ls, new Set(["a", "c"]), [], false);
    expect(result).toBeNull();
  });

  it("rejects selection overlapping existing groups", () => {
    const ls = lines([{ id: "a", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }, { id: "b" }]);
    expect(selectionTouchesAnyGroup(ls, new Set(["a"]))).toBe(true);
    expect(createGroupFromSelection(ls, new Set(["a", "b"]), [], false)).toBeNull();
  });

  it("shares timing in the new group when the setting is on", () => {
    const ls = lines([{ id: "a", begin: 1, end: 2 }, { id: "b" }]);
    const result = createGroupFromSelection(ls, new Set(["a", "b"]), [], true);
    expect(result?.group.sharesTiming).toBe(true);
    expect(result?.group.ownTimingInstances).toBeUndefined();
  });

  it("creates an old group when the setting is off", () => {
    const ls = lines([{ id: "a", begin: 1, end: 2 }]);
    const result = createGroupFromSelection(ls, new Set(["a"]), [], false);
    expect(result?.group.sharesTiming).toBeUndefined();
  });
});

describe("instanceToTemplate", () => {
  it("converts an instance's lines into relative-offset templates", () => {
    const ls: LyricLine[] = [
      lineFromFields({
        id: "a",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { id: "w1", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
          { id: "w2", text: "love", sep: " ", begin: 30.4, end: 30.9, joinsNext: false },
          { id: "w3", text: "you", sep: "", begin: 30.9, end: 32, joinsNext: false },
        ],
      }),
      lineFromFields({
        id: "b",
        text: "yeah",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 1,
        words: [{ id: "w4", text: "yeah", sep: "", begin: 32, end: 33, joinsNext: false }],
      }),
    ];

    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl).toHaveLength(2);
    expect(tpl[0].relativeBegin).toBeCloseTo(0);
    expect(tpl[0].relativeEnd).toBeCloseTo(2);
    expect(tpl[0].words?.[2].relativeEnd).toBeCloseTo(2);
    expect(tpl[1].relativeBegin).toBeCloseTo(2);
    expect(tpl[1].words?.[0].relativeEnd).toBeCloseTo(3);
  });

  it("uses earliest bg-word begin as the start anchor when bg precedes main", () => {
    const ls: LyricLine[] = [
      lineFromFields({
        id: "a",
        text: "hi",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        backgroundWords: [{ id: "w5", text: "yeah", sep: "", begin: 28, end: 29, joinsNext: false }],
        words: [{ id: "w6", text: "hi", sep: "", begin: 30, end: 31, joinsNext: false }],
      }),
    ];
    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl[0].words?.[0].relativeBegin).toBeCloseTo(2);
    expect(tpl[0].backgroundWords?.[0].relativeBegin).toBeCloseTo(0);
  });

  it("carries backgroundTextSource from a real line into the template", () => {
    const ls: LyricLine[] = [
      lineFromFields({
        id: "a",
        text: "main",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [{ id: "w7", text: "main", sep: "", begin: 30, end: 31, joinsNext: false }],
        backgroundText: "ooh",
        backgroundWords: [{ id: "w8", text: "ooh", sep: "", begin: 30, end: 30.5, joinsNext: false }],
        backgroundTextSource: "extraction",
      }),
    ];
    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl[0].backgroundTextSource).toBe("extraction");
  });

  it("carries a manual-sourced background flag into the template", () => {
    const ls: LyricLine[] = [
      lineFromFields({
        id: "a",
        text: "main",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [{ id: "w9", text: "main", sep: "", begin: 30, end: 31, joinsNext: false }],
        backgroundText: "ooh",
        backgroundTextSource: "manual",
      }),
    ];
    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl[0].backgroundTextSource).toBe("manual");
  });

  it("leaves backgroundTextSource undefined for a line with no background", () => {
    const ls: LyricLine[] = [
      lineFromFields({
        id: "a",
        text: "main",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [{ id: "w10", text: "main", sep: "", begin: 30, end: 31, joinsNext: false }],
      }),
    ];
    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl[0].backgroundTextSource).toBeUndefined();
  });

  it("uses word-derived start anchor even when line.begin/end is stale (regression)", () => {
    const ls: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "x",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { id: "w11", text: "hello", sep: " ", begin: 5, end: 6, joinsNext: false },
          { id: "w12", text: "world", sep: "", begin: 6, end: 7, joinsNext: false },
        ],
      }),
    ];
    const template = instanceToTemplate(ls, "g1", 0);
    expect(template).toHaveLength(1);
    expect(template[0].words?.[0].relativeBegin).toBeCloseTo(0);
    expect(template[0].words?.[1].relativeEnd).toBeCloseTo(2);
  });
});

describe("createGroupFromSelection · group color", () => {
  it("picks an unused color from the palette", () => {
    const existing: LinkGroup[] = [{ id: "g1", label: "x", color: "#f472b6", templateVersion: 1 }];
    const ls = lines([{ id: "a" }]);
    const result = createGroupFromSelection(ls, new Set(["a"]), existing, false);
    expect(result?.group.color).not.toBe("#f472b6");
  });
});
