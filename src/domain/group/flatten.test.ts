import { describe, expect, it } from "vitest";
import { docFromFlatLines } from "@/domain/group/doc-from-flat-lines";
import { flattenBody } from "@/domain/group/flatten";
import type { Instance, LyricDoc } from "insync/group";
import { instanceKey } from "insync/instance-key";
import { mainTrack, timedSyllables } from "insync/line-track";
import { createLine } from "@/test/factories";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

const glow = (id: string, instanceIdx: number, begin: number, groupId = "chorus") =>
  createLine({
    id,
    groupId,
    instanceIdx,
    templateLineIdx: 0,
    words: [
      { text: "We", sep: " ", begin, end: begin + 0.5 },
      { text: "glow", sep: " ", begin: begin + 0.5, end: begin + 1 },
      { text: "tonight", begin: begin + 1, end: begin + 2 },
    ],
  });

const instanceOf = (doc: LyricDoc, idx: number, groupId = "chorus") => doc.instances[instanceKey(groupId, idx)];

const withInstance = (doc: LyricDoc, instance: Instance): LyricDoc => ({
  ...doc,
  instances: { ...doc.instances, [instanceKey(instance.groupId, instance.idx)]: instance },
});

const spans = (doc: LyricDoc, lineId: string) =>
  timedSyllables(mainTrack(flattenBody(doc).find((line) => line.id === lineId) ?? glow("x", 0, 0))).map((syllable) => [
    syllable.begin,
    syllable.end,
  ]);

describe("flattenBody", () => {
  it("a shared instance is its template at its anchor, with its own line ids", () => {
    const doc = docFromFlatLines([glow("first", 0, 12), glow("second", 1, 44)], DEFAULT_SPLIT_CHARACTER);
    const second = instanceOf(doc, 1);
    expect(second).toMatchObject({ at: 44, lineIds: { 0: "second" } });
    expect(second?.ownTiming).toBeUndefined();
    expect(spans(withInstance(doc, { ...second, at: 60 }), "second")).toEqual([
      [60, 60.5],
      [60.5, 61],
      [61, 62],
    ]);
  });

  it("an own-timing instance reads its own spans and leaves missing syllables untimed", () => {
    const doc = docFromFlatLines([glow("first", 0, 12), glow("second", 1, 44)], DEFAULT_SPLIT_CHARACTER);
    const [we, glowWord] = timedSyllables(mainTrack(flattenBody(doc)[0]));
    const own: Instance = {
      ...instanceOf(doc, 1),
      at: undefined,
      ownTiming: { syllables: { [we.id]: [40, 40.3], [glowWord.id]: [40.3, 41] } },
    };
    const line = flattenBody(withInstance(doc, own))[1];
    expect(timedSyllables(mainTrack(line)).map((syllable) => [syllable.text, syllable.begin, syllable.end])).toEqual([
      ["We", 40, 40.3],
      ["glow", 40.3, 41],
    ]);
    expect(mainTrack(line).syllables.map((syllable) => syllable.text)).toEqual(["We", "glow", "tonight"]);
  });

  it("an unchanged instance keeps its line objects after another group's template changes", () => {
    const lines = [glow("a0", 0, 12, "a"), glow("b0", 0, 30, "b"), glow("b1", 1, 50, "b")];
    const doc = docFromFlatLines(lines, DEFAULT_SPLIT_CHARACTER);
    const templateB = doc.templates.b.map((line) => ({ ...line }));
    const flat = flattenBody({ ...doc, templates: { ...doc.templates, b: templateB } });
    expect(flat[0]).toBe(lines[0]);
    expect(flat[1]).not.toBe(lines[1]);
    expect(flat[1]).toEqual(lines[1]);
  });

  it("flat lines a template cannot hold read back exactly", () => {
    const lines = [
      glow("first", 0, 12),
      createLine({ id: "verse", text: "Lanterns over water" }),
      { ...glow("second", 1, 44.25), detached: true },
      createLine({ id: "odd", text: "Ash and ember", groupId: "chorus", instanceIdx: 2, templateLineIdx: 0 }),
      glow("late", 0, 80),
    ];
    expect(flattenBody(structuredClone(docFromFlatLines(lines, DEFAULT_SPLIT_CHARACTER)))).toEqual(lines);
  });

  it("renames ids only, never text that starts like one", () => {
    const line = (id: string, instanceIdx: number, begin: number) =>
      createLine({
        id,
        groupId: "chorus",
        instanceIdx,
        templateLineIdx: 0,
        words: [
          { text: "intro:", sep: " ", begin, end: begin + 0.5 },
          { text: "fade", begin: begin + 0.5, end: begin + 1 },
        ],
      });
    const lines = [line("intro", 0, 10), line("outro", 1, 40)];
    const doc = docFromFlatLines(lines, DEFAULT_SPLIT_CHARACTER);
    expect(instanceOf(doc, 1)?.replaced).toBeUndefined();
    expect(flattenBody(structuredClone(doc))).toEqual(lines);
  });
});
