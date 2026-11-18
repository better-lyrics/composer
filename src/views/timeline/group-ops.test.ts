/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { addInstance } from "insync/commands/instance-edits";
import type { LinkGroup } from "insync/group";
import { withSeededBackground } from "insync/line-background";
import { type LineFields, lineFromFields } from "insync/line-from-fields";
import type { LyricLine } from "insync/line";
import { backgroundTrack, timedSyllables } from "insync/line-track";
import { mainBounds } from "insync/line-bounds";
import { lineText } from "insync/line-text";
import { useProjectStore } from "@/stores/project";
import { createGroup } from "@/test/factories";
import {
  createGroupFromSelection,
  instanceToTemplate,
  lineIdsAreContiguous,
  selectionTouchesAnyGroup,
} from "./group-ops";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

const lines = (overrides: Partial<LineFields>[]): LyricLine[] =>
  overrides.map((o, i) => lineFromFields({ id: `l${i}`, text: `t${i}`, agentId: "v1", ...o }, DEFAULT_SPLIT_CHARACTER));

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
      lineFromFields(
        {
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
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
      lineFromFields(
        {
          id: "b",
          text: "yeah",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 1,
          words: [{ id: "w4", text: "yeah", sep: "", begin: 32, end: 33, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];

    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl).toHaveLength(2);
    expect(tpl[0].relativeBegin).toBeCloseTo(0);
    expect(tpl[0].relativeEnd).toBeCloseTo(2);
    expect(tpl[0].words?.[2].relativeEnd).toBeCloseTo(2);
    expect(tpl[1].relativeBegin).toBeCloseTo(2);
    expect(tpl[1].words?.[0].relativeEnd).toBeCloseTo(3);
  });

  it("regression: keeps the timing of a line-synced background", () => {
    const line = withSeededBackground(
      lineFromFields(
        {
          id: "a",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 10,
          end: 14,
          backgroundText: "ooh",
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
      DEFAULT_SPLIT_CHARACTER,
    );
    const [template] = instanceToTemplate([line], "g1", 0);
    // The instance starts where the line's own span starts, so the seeded second-half background sits 2 s in.
    expect(template.backgroundWords?.map((word) => [word.relativeBegin, word.relativeEnd])).toEqual([[2, 4]]);
  });

  it("regression: an instance added from a line-synced background keeps a background span", () => {
    const line = withSeededBackground(
      lineFromFields(
        {
          id: "a",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 10,
          end: 14,
          backgroundText: "ooh",
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
      DEFAULT_SPLIT_CHARACTER,
    );
    useProjectStore.setState({ lines: [line], groups: [createGroup({ id: "g1" })] });
    useProjectStore.getState().commit(addInstance("g1", instanceToTemplate([line], "g1", 0), 40));
    const added = useProjectStore.getState().lines[1];
    // The added instance's line starts at 40, so its second-half background keeps its place in the line.
    expect(backgroundTrack(added)).toMatchObject({ begin: 42, end: 44 });
    expect(timedSyllables(backgroundTrack(added))).toEqual([]);
  });

  it("uses earliest bg-word begin as the start anchor when bg precedes main", () => {
    const ls: LyricLine[] = [
      lineFromFields(
        {
          id: "a",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundWords: [{ id: "w5", text: "yeah", sep: "", begin: 28, end: 29, joinsNext: false }],
          words: [{ id: "w6", text: "hi", sep: "", begin: 30, end: 31, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl[0].words?.[0].relativeBegin).toBeCloseTo(2);
    expect(tpl[0].backgroundWords?.[0].relativeBegin).toBeCloseTo(0);
  });

  it("carries backgroundTextSource from a real line into the template", () => {
    const ls: LyricLine[] = [
      lineFromFields(
        {
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
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl[0].backgroundTextSource).toBe("extraction");
  });

  it("carries a manual-sourced background flag into the template", () => {
    const ls: LyricLine[] = [
      lineFromFields(
        {
          id: "a",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w9", text: "main", sep: "", begin: 30, end: 31, joinsNext: false }],
          backgroundText: "ooh",
          backgroundTextSource: "manual",
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl[0].backgroundTextSource).toBe("manual");
  });

  it("leaves backgroundTextSource undefined for a line with no background", () => {
    const ls: LyricLine[] = [
      lineFromFields(
        {
          id: "a",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w10", text: "main", sep: "", begin: 30, end: 31, joinsNext: false }],
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const tpl = instanceToTemplate(ls, "g1", 0);
    expect(tpl[0].backgroundTextSource).toBeUndefined();
  });

  it("uses word-derived start anchor even when line.begin/end is stale (regression)", () => {
    const ls: LyricLine[] = [
      lineFromFields(
        {
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
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ];
    const template = instanceToTemplate(ls, "g1", 0);
    expect(template).toHaveLength(1);
    expect(template[0].words?.[0].relativeBegin).toBeCloseTo(0);
    expect(template[0].words?.[1].relativeEnd).toBeCloseTo(2);
  });

  const slotLine = (
    id: string,
    instanceIdx: number,
    templateLineIdx: number,
    words: Array<[string, number, number]>,
    detached?: true,
  ): LyricLine =>
    lineFromFields(
      {
        id,
        text: words.map(([text]) => text).join(" "),
        agentId: "v1",
        groupId: "g1",
        instanceIdx,
        templateLineIdx,
        ...(detached && { detached }),
        words: words.map(([text, begin, end], index) => ({
          id: `${id}-w${index}`,
          text,
          sep: index < words.length - 1 ? " " : "",
          begin,
          end,
          joinsNext: false,
        })),
      },
      DEFAULT_SPLIT_CHARACTER,
    );

  it("regression: an instance added from one with a detached row takes that slot from an intact instance", () => {
    const ls = [
      slotLine("a0", 0, 0, [["Lanterns", 1, 1.5]], true),
      slotLine("b0", 0, 1, [
        ["Paper", 5, 5.5],
        ["wings", 5.6, 6.5],
      ]),
      slotLine("a1", 1, 0, [
        ["Lanterns", 11, 11.5],
        ["glowing", 11.6, 12.5],
      ]),
      slotLine("b1", 1, 1, [
        ["Paper", 15, 15.5],
        ["wings", 15.6, 16.5],
      ]),
    ];
    useProjectStore.setState({ lines: ls, groups: [createGroup({ id: "g1" })] });
    useProjectStore.getState().commit(addInstance("g1", instanceToTemplate(ls, "g1", 0), 40));
    const added = useProjectStore.getState().lines.filter((line) => line.groupId === "g1" && line.instanceIdx === 2);
    expect(
      added.map((line) => [line.templateLineIdx, lineText(line, DEFAULT_SPLIT_CHARACTER), mainBounds(line)]),
    ).toEqual([
      [0, "Lanterns glowing", { begin: 40, end: 41.5 }],
      [1, "Paper wings", { begin: 44, end: 45.5 }],
    ]);
  });

  it("regression: an instance added from a group without its first slot keeps each line's slot", () => {
    const ls = [slotLine("b0", 0, 1, [["Paper", 5, 5.5]]), slotLine("c0", 0, 2, [["wings", 6, 6.5]])];
    useProjectStore.setState({ lines: ls, groups: [createGroup({ id: "g1" })] });
    useProjectStore.getState().commit(addInstance("g1", instanceToTemplate(ls, "g1", 0), 40));
    const added = useProjectStore.getState().lines.filter((line) => line.instanceIdx === 1);
    expect(added.map((line) => line.templateLineIdx)).toEqual([1, 2]);
  });

  it("regression: a slot from an instance sharing no timed slot with the pick comes in untimed", () => {
    const ls = [
      slotLine("a0", 0, 0, [["Lanterns", 1, 1.5]], true),
      slotLine("b0", 0, 1, [["Paper", 5, 5.5]]),
      slotLine("a1", 1, 0, [["Lanterns", 60, 60.5]]),
    ];
    useProjectStore.setState({ lines: ls, groups: [createGroup({ id: "g1" })] });
    useProjectStore.getState().commit(addInstance("g1", instanceToTemplate(ls, "g1", 0), 40));
    const added = useProjectStore.getState().lines.filter((line) => line.groupId === "g1" && line.instanceIdx === 2);
    expect(
      added.map((line) => [line.templateLineIdx, lineText(line, DEFAULT_SPLIT_CHARACTER), mainBounds(line)]),
    ).toEqual([
      [0, "Lanterns", null],
      [1, "Paper", { begin: 40, end: 40.5 }],
    ]);
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
