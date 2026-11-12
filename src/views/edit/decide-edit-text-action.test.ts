/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { decideEditTextAction } from "./decide-edit-text-action";

const groupChorus: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };

function chorusLines(): LyricLine[] {
  return [
    { id: "c1a", text: "I love you", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
    { id: "c1b", text: "more than words", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
    { id: "v1", text: "verse line", agentId: "v1" },
    { id: "c2a", text: "I love you", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 },
    { id: "c2b", text: "more than words", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 1 },
  ];
}

const baseText = (lines: LyricLine[]) => lines.map((l) => l.text).join("\n");

describe("decideEditTextAction", () => {
  it("returns noop when text is unchanged", () => {
    const lines = chorusLines();
    const action = decideEditTextAction({
      text: baseText(lines),
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
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
    });
    expect(action.kind).toBe("apply");
    if (action.kind !== "apply") return;
    expect(action.finalLines.find((l) => l.id === "c1a")?.text).toBe("I luv you");
    expect(action.finalLines.find((l) => l.id === "c2a")?.text).toBe("I luv you");
  });

  it("returns the edit text with linked siblings rewritten and typed rows verbatim", () => {
    const lines = chorusLines();
    const text = baseText(lines).replace("I love you", "I luv you ").replace("verse line", "verse  line");
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
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
    });
    expect(action.kind).toBe("apply");
    if (action.kind !== "apply") return;
    expect(action.finalLines.length).toBe(lines.length + 1);
    expect(action.finalLines[action.finalLines.length - 1].text).toBe("brand new outro");
  });

  it("returns detach when a chorus instance loses a row", () => {
    const lines = chorusLines();
    const text = ["I love you", "verse line", "I love you", "more than words"].join("\n");
    const action = decideEditTextAction({
      text,
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
    });
    expect(action.kind).toBe("detach");
    if (action.kind !== "detach") return;
    expect(action.detachedNames).toEqual(["Chorus 1"]);
    expect(action.finalLines.filter((line) => line.groupId === "g1")).toHaveLength(2);
  });

  it("returns detach but does NOT mutate input lines", () => {
    const lines = chorusLines();
    const before = JSON.parse(JSON.stringify(lines));
    decideEditTextAction({
      text: "totally\ndifferent\nstuff",
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
    });
    expect(lines).toEqual(before);
  });

  it("names every detached instance and drops a group left with no lines", () => {
    const lines: LyricLine[] = [
      { id: "a", text: "foo", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      { id: "b", text: "foo", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 },
    ];
    const action = decideEditTextAction({
      text: "",
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
    });
    expect(action.kind).toBe("detach");
    if (action.kind !== "detach") return;
    expect(action.detachedNames).toEqual(["Chorus 1", "Chorus 2"]);
    expect(action.groups).toEqual([]);
  });

  it("propagates a content edit to a sibling instance via apply", () => {
    const lines: LyricLine[] = [
      {
        id: "a",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 0, end: 0.4 },
          { text: "love ", begin: 0.4, end: 0.8 },
          { text: "you", begin: 0.8, end: 1.2 },
        ],
      },
      {
        id: "b",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 30, end: 30.5 },
          { text: "love ", begin: 30.5, end: 31.0 },
          { text: "you", begin: 31.0, end: 31.5 },
        ],
      },
    ];
    const action = decideEditTextAction({
      text: "I luv you\nI love you",
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
    });
    expect(action.kind).toBe("apply");
    if (action.kind !== "apply") return;
    const a = action.finalLines.find((l) => l.id === "a");
    const b = action.finalLines.find((l) => l.id === "b");
    expect(a?.text).toBe("I luv you");
    expect(a?.words?.[1].text).toBe("luv ");
    expect(a?.words?.[1].begin).toBe(0.4);
    expect(b?.text).toBe("I luv you");
    expect(b?.words?.[1].text).toBe("luv ");
    expect(b?.words?.[1].begin).toBe(30.5);
  });

  it("returns apply (with empty group cleanup unrelated) when impacted is empty even on length change outside group", () => {
    const lines: LyricLine[] = [{ id: "a", text: "first", agentId: "v1" }];
    const action = decideEditTextAction({
      text: "first\nsecond",
      defaultAgentId: "v1",
      lines,
      groups: [],
    });
    expect(action.kind).toBe("apply");
  });
});

describe("regressions", () => {
  it("regression: editing a linked group applies at once and undoes in one step", () => {
    const lines = chorusLines();
    useProjectStore.setState({ lines, groups: [groupChorus] });
    useProjectStore.getState().clearHistory();
    const text = ["I love you", "verse line", "I love you", "more than words"].join("\n");

    const action = decideEditTextAction({ text, defaultAgentId: "v1", lines, groups: [groupChorus] });
    if (action.kind !== "detach") throw new Error(`expected detach, got ${action.kind}`);
    useProjectStore.getState().setLinesWithHistory(action.finalLines, action.groups);

    expect(useProjectStore.getState().lines.map((line) => line.text)).toEqual(text.split("\n"));
    expect(action.detachedNames).toEqual(["Chorus 1"]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines).toEqual(lines);
    expect(useProjectStore.getState().groups).toEqual([groupChorus]);
  });

  it("regression: enter inside one copy of identical linked lines detaches only that copy", () => {
    const verse = (id: string, text: string): LyricLine => ({ id, text, agentId: "v1" });
    const chorus = (instanceIdx: number): LyricLine[] =>
      ["Hold the line and let it ring", "Every echo finds its way home"].map((text, templateLineIdx) => ({
        id: `c${instanceIdx}-${templateLineIdx}`,
        text,
        agentId: "v1",
        groupId: "g1",
        instanceIdx,
        templateLineIdx,
      }));
    const lines = [
      verse("v1", "Lanterns lean against the gate"),
      ...chorus(0),
      verse("v2", "Paper boats along the drain"),
      ...chorus(1),
      verse("v3", "Morning folds the city small"),
      ...chorus(2),
    ];
    const text = baseText(lines).replace("Hold the line and let it ring", "Hold the\nline and let it ring");
    const action = decideEditTextAction({ text, defaultAgentId: "v1", lines, groups: [groupChorus] });
    if (action.kind !== "detach") throw new Error(`expected detach, got ${action.kind}`);
    expect(action.detachedNames).toEqual(["Chorus 1"]);
    expect(action.finalLines.slice(1, 4).filter((line) => line.groupId !== undefined)).toEqual([]);
    expect(action.finalLines.slice(5)).toEqual(lines.slice(4));
  });

  it("regression: restores the neighbour word timing after the added word is removed", () => {
    const words = [
      { text: "one ", begin: 0, end: 1 },
      { text: "two ", begin: 1, end: 2 },
      { text: "three", begin: 2, end: 3 },
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
    });
    if (step1.kind !== "apply") throw new Error(step1.kind);
    const step2 = decideEditTextAction({
      text: "one two three\none extra two three",
      defaultAgentId: "v1",
      lines: step1.finalLines,
      groups: [],
    });
    if (step2.kind !== "apply") throw new Error(step2.kind);
    expect(step2.finalLines[0].words).toEqual(lines[0].words);
    expect(step2.finalLines[1].words).toEqual(lines[1].words);
  });
  it("keeps every untouched line as the same object through a keystroke", () => {
    const lines: LyricLine[] = [
      { id: "a", text: "Under the porch light (hey)", agentId: "v2", begin: 1, end: 3 },
      { id: "b", text: "we counted the trains", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      { id: "c", text: "(ooh) slow and steady", agentId: "v1" },
    ];
    const action = decideEditTextAction({
      text: "Under the porch light (hey)\nwe counted the train\n(ooh) slow and steady",
      defaultAgentId: "v1",
      lines,
      groups: [groupChorus],
    });
    if (action.kind !== "apply") throw new Error(action.kind);
    expect(action.finalLines[0]).toBe(lines[0]);
    expect(action.finalLines[2]).toBe(lines[2]);
    expect(action.finalLines[1]).toMatchObject({
      id: "b",
      text: "we counted the train",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
    });
  });
});
