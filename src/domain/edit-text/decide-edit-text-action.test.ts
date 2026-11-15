/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import type { LinkGroup } from "insync/group";
import { fieldsOfLine, lineFromFields } from "insync/line-from-fields";
import type { LyricLine } from "insync/line";
import { lineText } from "insync/line-text";
import { backgroundTrack, mainTrack, timedSyllables } from "insync/line-track";
import { shownEditText } from "insync/edit-text-shown-row";
import { remapBackgroundRanges } from "@/domain/edit-text/background-ranges";
import { useSettingsStore } from "@/stores/settings";
import { createLine } from "@/test/factories";
import { decideEditTextAction } from "./decide-edit-text-action";
import { getSplitCharacter } from "@/utils/split-character";

const groupChorus: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };

function chorusLines(): LyricLine[] {
  return [
    lineFromFields(
      { id: "c1a", text: "I love you", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      getSplitCharacter(),
    ),
    lineFromFields(
      {
        id: "c1b",
        text: "more than words",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 1,
      },
      getSplitCharacter(),
    ),
    lineFromFields({ id: "v1", text: "verse line", agentId: "v1" }, getSplitCharacter()),
    lineFromFields(
      { id: "c2a", text: "I love you", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 },
      getSplitCharacter(),
    ),
    lineFromFields(
      {
        id: "c2b",
        text: "more than words",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 1,
      },
      getSplitCharacter(),
    ),
  ];
}

const baseText = (lines: LyricLine[]) => lines.map((l) => lineText(l, getSplitCharacter())).join("\n");

describe("decideEditTextAction", () => {
  it("returns noop when text is unchanged", () => {
    const lines = chorusLines();
    const action = decideEditTextAction({
      text: baseText(lines),
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    expect(action.kind).toBe("noop");
  });

  it("returns apply for content-only edits (typo fix)", () => {
    const lines = chorusLines();
    const text = baseText(lines).replace("I love you", "I luv you");
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    expect(action.kind).toBe("apply");
    if (action.kind !== "apply") return;
    expect(lineText(action.finalLines.find((l) => l.id === "c1a")!, getSplitCharacter())).toBe("I luv you");
    expect(lineText(action.finalLines.find((l) => l.id === "c2a")!, getSplitCharacter())).toBe("I luv you");
  });

  it("returns the edit text with linked siblings rewritten and typed rows verbatim", () => {
    const lines = chorusLines();
    const text = baseText(lines).replace("I love you", "I luv you ").replace("verse line", "verse  line");
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    if (action.kind !== "apply") throw new Error(`expected apply, got ${action.kind}`);
    expect(action.editText).toBe("I luv you \nmore than words\nverse  line\nI luv you\nmore than words");
  });

  it("returns the typed text verbatim as the edit text for a structural apply", () => {
    const lines = chorusLines();
    const text = `${baseText(lines)}\n  brand new outro`;
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    if (action.kind !== "apply") throw new Error(`expected apply, got ${action.kind}`);
    expect(action.editText).toBe(text);
  });

  it("returns apply for structural changes outside any group (no confirm)", () => {
    const lines = chorusLines();
    const text = `${baseText(lines)}\nbrand new outro`;
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    expect(action.kind).toBe("apply");
    if (action.kind !== "apply") return;
    expect(action.finalLines.length).toBe(lines.length + 1);
    expect(lineText(action.finalLines[action.finalLines.length - 1], getSplitCharacter())).toBe("brand new outro");
  });

  it("a row split out of a chorus line makes only that line its instance's own", () => {
    const lines = chorusLines();
    const text = ["I love you", "more than words", "verse line", "I love", "you", "more than words"].join("\n");
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    if (action.kind !== "apply") throw new Error(`expected apply, got ${action.kind}`);
    expect(action.detachedIds).toEqual(["c2a"]);
    const byId = new Map(action.finalLines.map((line) => [line.id, line]));
    expect(byId.get("c2a")).toMatchObject({ groupId: "g1", instanceIdx: 1, templateLineIdx: 0, detached: true });
    expect(lineText(byId.get("c2a")!, getSplitCharacter())).toBe("I love");
    expect(lineText(byId.get("c1a")!, getSplitCharacter())).toBe("I love you");
    expect(byId.get("c1a")?.detached).toBeUndefined();
    expect(byId.get("c2b")?.detached).toBeUndefined();
  });

  it("does not mutate input lines", () => {
    const lines = chorusLines();
    const before = JSON.parse(JSON.stringify(lines));
    decideEditTextAction({
      text: "totally\ndifferent\nstuff",
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    expect(lines).toEqual(before);
  });

  it("propagates a content edit to a sibling instance via apply", () => {
    const lines: LyricLine[] = [
      lineFromFields(
        {
          id: "a",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w1", text: "I", sep: " ", begin: 0, end: 0.4, joinsNext: false },
            { id: "w2", text: "love", sep: " ", begin: 0.4, end: 0.8, joinsNext: false },
            { id: "w3", text: "you", sep: "", begin: 0.8, end: 1.2, joinsNext: false },
          ],
        },
        getSplitCharacter(),
      ),
      lineFromFields(
        {
          id: "b",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w4", text: "I", sep: " ", begin: 30, end: 30.5, joinsNext: false },
            { id: "w5", text: "love", sep: " ", begin: 30.5, end: 31.0, joinsNext: false },
            { id: "w6", text: "you", sep: "", begin: 31.0, end: 31.5, joinsNext: false },
          ],
        },
        getSplitCharacter(),
      ),
    ];
    const action = decideEditTextAction({
      text: "I luv you\nI love you",
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    expect(action.kind).toBe("apply");
    if (action.kind !== "apply") return;
    const a = action.finalLines.find((l) => l.id === "a");
    const b = action.finalLines.find((l) => l.id === "b");
    expect(lineText(a!, getSplitCharacter())).toBe("I luv you");
    expect(timedSyllables(mainTrack(a!))[1]).toMatchObject({ text: "luv", sep: " " });
    expect(timedSyllables(mainTrack(a!))[1].begin).toBe(0.4);
    expect(lineText(b!, getSplitCharacter())).toBe("I luv you");
    expect(timedSyllables(mainTrack(b!))[1]).toMatchObject({ text: "luv", sep: " " });
    expect(timedSyllables(mainTrack(b!))[1].begin).toBe(30.5);
  });

  it("returns apply (with empty group cleanup unrelated) when impacted is empty even on length change outside group", () => {
    const lines: LyricLine[] = [lineFromFields({ id: "a", text: "first", agentId: "v1" }, getSplitCharacter())];
    const action = decideEditTextAction({
      text: "first\nsecond",
      defaultAgentId: "v1",
      lines,
      groups: [],
      splitCharacter: getSplitCharacter(),
    });
    expect(action.kind).toBe("apply");
  });
});

describe("regressions", () => {
  it("regression: text written with the previous split character keeps every split word's syllables", () => {
    useSettingsStore.setState({ splitCharacter: "|" });
    const line = createLine({
      id: "l1",
      text: "hel|lo world",
      words: [
        { text: "hel", sep: "", begin: 1, end: 1.4, joinsNext: true },
        { text: "lo", sep: " ", begin: 1.4, end: 2 },
        { text: "world", begin: 2, end: 3 },
      ],
    });
    useSettingsStore.setState({ splitCharacter: "/" });
    const action = decideEditTextAction({
      text: "hel|lo world!",
      defaultAgentId: "v1",
      lines: [line],
      groups: [],
      splitCharacter: "|",
    });
    if (action.kind !== "apply") throw new Error(`expected apply, got ${action.kind}`);
    const syllables = timedSyllables(mainTrack(action.finalLines[0]));
    expect(syllables.map(({ text, begin, end }) => [text, begin, end])).toEqual([
      ["hel", 1, 1.4],
      ["lo", 1.4, 2],
      ["world!", 2, 3],
    ]);
  });

  it("regression: restores the neighbour word timing after the added word is removed", () => {
    const words = [
      { id: "w7", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w8", text: "two", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w9", text: "three", sep: "", begin: 2, end: 3, joinsNext: false },
    ];
    const lines = [
      createLine({ id: "a", text: "one two three", words, groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }),
      createLine({
        id: "b",
        text: "one two three",
        words: words.map((w) => ({ ...w, begin: w.begin + 10, end: w.end + 10 })),
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
      }),
    ];
    const step1 = decideEditTextAction({
      text: "one extra two three\none two three",
      defaultAgentId: "v1",
      lines,
      groups: [],
      splitCharacter: getSplitCharacter(),
    });
    if (step1.kind !== "apply") throw new Error(step1.kind);
    const step2 = decideEditTextAction({
      text: "one two three\none extra two three",
      defaultAgentId: "v1",
      lines: step1.finalLines,
      groups: [],
      splitCharacter: getSplitCharacter(),
    });
    if (step2.kind !== "apply") throw new Error(step2.kind);
    expect(timedSyllables(mainTrack(step2.finalLines[0]))).toEqual(timedSyllables(mainTrack(lines[0])));
    expect(timedSyllables(mainTrack(step2.finalLines[1]))).toEqual(timedSyllables(mainTrack(lines[1])));
  });
  it("keeps every untouched line as the same object through a keystroke", () => {
    const lines: LyricLine[] = [
      lineFromFields(
        { id: "a", text: "Under the porch light (hey)", agentId: "v2", begin: 1, end: 3 },
        getSplitCharacter(),
      ),
      lineFromFields(
        {
          id: "b",
          text: "we counted the trains",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
        },
        getSplitCharacter(),
      ),
      lineFromFields({ id: "c", text: "(ooh) slow and steady", agentId: "v1" }, getSplitCharacter()),
    ];
    const action = decideEditTextAction({
      text: "Under the porch light (hey)\nwe counted the train\n(ooh) slow and steady",
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    if (action.kind !== "apply") throw new Error(action.kind);
    expect(action.finalLines[0]).toBe(lines[0]);
    expect(action.finalLines[2]).toBe(lines[2]);
    expect(fieldsOfLine(action.finalLines[1], getSplitCharacter())).toMatchObject({
      id: "b",
      text: "we counted the train",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
    });
  });
});

describe("typing in a line-synced instance", () => {
  it("regression: keeps a word-synced instance's own word timing", () => {
    const lines: LyricLine[] = [
      lineFromFields(
        {
          id: "a",
          text: "We glow tonight",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 10,
          end: 12,
        },
        getSplitCharacter(),
      ),
      lineFromFields(
        {
          id: "b",
          text: "We glow tonight",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w1", text: "We", sep: " ", begin: 40, end: 40.5, joinsNext: false },
            { id: "w2", text: "glow", sep: " ", begin: 40.5, end: 41, joinsNext: false },
            { id: "w3", text: "tonight", sep: "", begin: 41, end: 41.5, joinsNext: false },
          ],
        },
        getSplitCharacter(),
      ),
    ];
    for (const text of ["We glow tonight now\nWe glow tonight", "We glow so bright\nWe glow tonight"]) {
      const action = decideEditTextAction({
        text,
        defaultAgentId: "v1",
        lines,
        groups: [groupChorus],
        splitCharacter: getSplitCharacter(),
      });
      if (action.kind !== "apply") throw new Error(action.kind);
      const copy = action.finalLines[1];
      expect(lineText(copy, getSplitCharacter())).toBe(lineText(action.finalLines[0], getSplitCharacter()));
      expect(
        timedSyllables(mainTrack(copy))
          .slice(0, 2)
          .map((word) => [word.text, word.begin]),
      ).toEqual([
        ["We", 40],
        ["glow", 40.5],
      ]);
    }
  });
});

describe("removing a group row", () => {
  it("regression: a group row removed with nothing in its place is named as that instance's own change", () => {
    const lines = chorusLines();
    const action = decideEditTextAction({
      text: ["I love you", "more than words", "verse line", "I love you"].join("\n"),
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: getSplitCharacter(),
    });
    if (action.kind !== "apply") throw new Error(`expected apply, got ${action.kind}`);
    expect(action.detachedIds).toEqual([]);
    expect(action.removedIds).toEqual(["c2b"]);
    expect(action.finalLines.map((line) => line.id)).toEqual(["c1a", "c1b", "v1", "c2a"]);
  });
});

describe("typing a split mark in an instance", () => {
  it("regression: reports the split it carried to the other instances, for the one-time notice", () => {
    const lines = chorusLines();
    const text = baseText(lines).replace("I love you", "I lo|ve you");
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
      splitCharacter: "|",
    });
    if (action.kind !== "apply") throw new Error(`expected apply, got ${action.kind}`);
    expect(action.splits).toEqual([{ groupId: "g1", instances: 2 }]);
  });
});

describe("a background-only line", () => {
  it("regression: a keystroke in another row keeps its background timed and its main text empty", () => {
    const lines = [
      createLine({ id: "above", text: "Lanterns drift away" }),
      createLine({
        id: "echo",
        text: "",
        backgroundWords: [{ id: "bg-1", text: "away", begin: 4, end: 5 }],
      }),
    ];
    const shown = shownEditText(lines, getSplitCharacter());
    const text = shown.text.replace("drift", "drifts");
    const ranges = remapBackgroundRanges(shown.text, text, shown.ranges, text.indexOf("drifts") + 6);
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [],
      splitCharacter: getSplitCharacter(),
      ranges,
    });
    if (action.kind !== "apply") throw new Error(`expected apply, got ${action.kind}`);
    const echo = action.finalLines[1];
    expect(lineText(echo, getSplitCharacter())).toBe("");
    expect(backgroundTrack(echo)?.syllables.map((syllable) => [syllable.id, syllable.begin])).toEqual([["bg-1", 4]]);
  });
});
