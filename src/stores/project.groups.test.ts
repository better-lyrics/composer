/**
 * @vitest-environment node
 */
import { type LineTemplate, type LinkGroup, type LyricLine, useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedGroup(id: string, overrides: Partial<LinkGroup> = {}): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1, ...overrides };
}

describe("project store · group types", () => {
  it("ProjectState includes empty groups array initially", () => {
    expect(useProjectStore.getState().groups).toEqual([]);
  });

  it("LyricLine accepts optional group fields", () => {
    const line: LyricLine = {
      id: "l1",
      text: "I love you",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
      detached: false,
    };
    expect(line.groupId).toBe("g1");
    expect(line.instanceIdx).toBe(0);
    expect(line.templateLineIdx).toBe(0);
    expect(line.detached).toBe(false);
  });

  it("LinkGroup has the expected shape", () => {
    const g: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    expect(g.id).toBe("g1");
    expect(g.label).toBe("Chorus");
    expect(g.color).toBe("#f472b6");
    expect(g.templateVersion).toBe(1);
  });
});

describe("project store · history captures groups", () => {
  it("undo restores groups alongside lines", () => {
    const initialGroups = [seedGroup("g1")];
    useProjectStore.setState({ groups: initialGroups, lines: [] });

    useProjectStore.getState().setLinesWithHistory([{ id: "l1", text: "test", agentId: "v1", groupId: "g1" }]);

    useProjectStore.setState({ groups: [] });

    useProjectStore.getState().setLinesWithHistory([{ id: "l2", text: "test2", agentId: "v1" }]);

    useProjectStore.getState().undo();

    expect(useProjectStore.getState().groups).toEqual(initialGroups);
  });

  it("redo restores the post-edit groups", () => {
    useProjectStore.setState({ groups: [seedGroup("g1")], lines: [] });

    useProjectStore.getState().setLinesWithHistory([{ id: "l1", text: "a", agentId: "v1" }]);

    useProjectStore.setState({ groups: [seedGroup("g1"), seedGroup("g2", { label: "Verse" })] });

    useProjectStore.getState().setLinesWithHistory([{ id: "l2", text: "b", agentId: "v1" }]);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().groups.map((g) => g.id)).toEqual(["g1"]);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().groups.map((g) => g.id)).toEqual(["g1", "g2"]);
  });

  it("commitHistory snapshots groups (verified through moveWordToBg path)", () => {
    useProjectStore.setState({ groups: [seedGroup("g1")] });
    const before = useProjectStore.getState().groups;

    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "hi there",
          agentId: "v1",
          words: [
            { text: "hi ", begin: 0, end: 1 },
            { text: "there", begin: 1, end: 2 },
          ],
        },
      ],
    });

    useProjectStore.getState().moveWordToBg("l1", [0], 0, 60);
    useProjectStore.getState().undo();

    expect(useProjectStore.getState().groups).toEqual(before);
  });
});

describe("project store · group registry mutators", () => {
  it("addGroup pushes to registry with history", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    expect(useProjectStore.getState().groups).toHaveLength(1);
    expect(useProjectStore.getState().groups[0].label).toBe("Chorus");
    expect(useProjectStore.getState().canUndo()).toBe(true);
  });

  it("addGroup is undoable", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().groups).toHaveLength(0);
  });

  it("addGroupWithLines undoes group + lines in a single step (no residue)", () => {
    useProjectStore.setState({
      lines: [
        { id: "l1", text: "a", agentId: "v1" },
        { id: "l2", text: "b", agentId: "v1" },
      ],
    });

    useProjectStore.getState().addGroupWithLines(seedGroup("g1"), [
      { id: "l1", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      { id: "l2", text: "b", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
    ]);

    expect(useProjectStore.getState().groups).toHaveLength(1);
    expect(useProjectStore.getState().lines[0].groupId).toBe("g1");

    useProjectStore.getState().undo();

    expect(useProjectStore.getState().groups).toHaveLength(0);
    expect(useProjectStore.getState().lines[0].groupId).toBeUndefined();
    expect(useProjectStore.getState().lines[1].groupId).toBeUndefined();
  });

  it("updateGroup merges fields", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.getState().updateGroup("g1", { label: "Refrain", color: "#60a5fa" });

    const g = useProjectStore.getState().groups[0];
    expect(g.label).toBe("Refrain");
    expect(g.color).toBe("#60a5fa");
    expect(g.templateVersion).toBe(1);
  });

  it("updateGroup leaves other groups untouched", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.getState().addGroup(seedGroup("g2", { label: "Verse" }));

    useProjectStore.getState().updateGroup("g1", { label: "Refrain" });

    const groups = useProjectStore.getState().groups;
    expect(groups.find((g) => g.id === "g1")?.label).toBe("Refrain");
    expect(groups.find((g) => g.id === "g2")?.label).toBe("Verse");
  });

  it("removeGroup deletes registry entry and clears group fields on lines", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "l1",
          text: "test",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
        },
        {
          id: "l2",
          text: "untouched",
          agentId: "v1",
        },
      ],
    });

    useProjectStore.getState().removeGroup("g1");

    expect(useProjectStore.getState().groups).toHaveLength(0);
    expect(useProjectStore.getState().lines[0].groupId).toBeUndefined();
    expect(useProjectStore.getState().lines[0].instanceIdx).toBeUndefined();
    expect(useProjectStore.getState().lines[0].templateLineIdx).toBeUndefined();
    expect(useProjectStore.getState().lines[1].text).toBe("untouched");
  });

  it("removeGroup is undoable (group + line fields restored together)", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore
      .getState()
      .setLinesWithHistory([
        { id: "l1", text: "test", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
      ]);

    useProjectStore.getState().removeGroup("g1");
    expect(useProjectStore.getState().groups).toHaveLength(0);
    expect(useProjectStore.getState().lines[0].groupId).toBeUndefined();

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().groups).toHaveLength(1);
    expect(useProjectStore.getState().lines[0].groupId).toBe("g1");
    expect(useProjectStore.getState().lines[0].instanceIdx).toBe(0);
  });
});

describe("project store · instance mutators", () => {
  function templateOf(text: string, words: Array<[string, number, number]>): LineTemplate {
    return {
      text,
      agentId: "v1",
      relativeBegin: words[0]?.[1] ?? 0,
      relativeEnd: words[words.length - 1]?.[2] ?? 0,
      words: words.map(([t, b, e]) => ({ text: t, relativeBegin: b, relativeEnd: e })),
    };
  }

  it("addInstance creates lines with shifted absolute timing", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const structure: LineTemplate[] = [
      templateOf("I love you", [
        ["I ", 0, 0.4],
        ["love ", 0.4, 0.8],
        ["you", 0.8, 1.2],
      ]),
    ];

    useProjectStore.getState().addInstance("g1", structure, 30);

    const created = useProjectStore.getState().lines.filter((l) => l.groupId === "g1");
    expect(created).toHaveLength(1);
    expect(created[0].instanceIdx).toBe(0);
    expect(created[0].templateLineIdx).toBe(0);
    expect(created[0].begin).toBeCloseTo(30);
    expect(created[0].end).toBeCloseTo(31.2);
    expect(created[0].words?.[1].begin).toBeCloseTo(30.4);
    expect(created[0].words?.[2].end).toBeCloseTo(31.2);
  });

  it("addInstance picks the next unused instanceIdx", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const structure: LineTemplate[] = [templateOf("a", [["a", 0, 0.5]])];

    useProjectStore.getState().addInstance("g1", structure, 10);
    useProjectStore.getState().addInstance("g1", structure, 20);
    useProjectStore.getState().addInstance("g1", structure, 30);

    const indices = useProjectStore
      .getState()
      .lines.filter((l) => l.groupId === "g1")
      .map((l) => l.instanceIdx)
      .sort();
    expect(indices).toEqual([0, 1, 2]);
  });

  it("removeInstance strips group fields from matching lines and leaves siblings", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        { id: "a0", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
        { id: "a1", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 },
        { id: "b0", text: "b", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
      ],
    });

    useProjectStore.getState().removeInstance("g1", 0);

    const lines = useProjectStore.getState().lines;
    expect(lines.find((l) => l.id === "a0")?.groupId).toBeUndefined();
    expect(lines.find((l) => l.id === "b0")?.groupId).toBeUndefined();
    expect(lines.find((l) => l.id === "a1")?.groupId).toBe("g1");
    expect(lines.find((l) => l.id === "a1")?.instanceIdx).toBe(1);
    expect(useProjectStore.getState().groups).toHaveLength(1);
  });

  it("removeInstance dissolves the group when removing the last instance", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [{ id: "a", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 }],
    });

    useProjectStore.getState().removeInstance("g1", 0);

    expect(useProjectStore.getState().groups).toHaveLength(0);
    expect(useProjectStore.getState().lines[0].groupId).toBeUndefined();
  });

  it("detachLine clears group fields on a single line and preserves text/timing", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { text: "I ", begin: 30, end: 30.4 },
            { text: "love ", begin: 30.4, end: 30.8 },
          ],
        },
      ],
    });

    useProjectStore.getState().detachLine("a");

    const line = useProjectStore.getState().lines[0];
    expect(line.groupId).toBeUndefined();
    expect(line.instanceIdx).toBeUndefined();
    expect(line.templateLineIdx).toBeUndefined();
    expect(line.text).toBe("I love you");
    expect(line.words?.[0].begin).toBeCloseTo(30);
  });

  it("instance mutators are undoable", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const structure: LineTemplate[] = [templateOf("a", [["a", 0, 0.5]])];
    useProjectStore.getState().addInstance("g1", structure, 5);

    expect(useProjectStore.getState().lines).toHaveLength(1);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines).toHaveLength(0);
  });
});

describe("project store · propagateLinkedEdit", () => {
  function seedTwoInstances() {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        { id: "a0", text: "I love you", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
        { id: "b0", text: "yeah", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
        { id: "a1", text: "I love you", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 0 },
        { id: "b1", text: "yeah", agentId: "v1", groupId: "g1", instanceIdx: 1, templateLineIdx: 1 },
      ],
    });
  }

  it("applies updates to all sibling lines with the same templateLineIdx", () => {
    seedTwoInstances();

    useProjectStore.getState().propagateLinkedEdit("g1", 0, { text: "I really love you" });

    const lines = useProjectStore.getState().lines;
    expect(lines.find((l) => l.id === "a0")?.text).toBe("I really love you");
    expect(lines.find((l) => l.id === "a1")?.text).toBe("I really love you");
    expect(lines.find((l) => l.id === "b0")?.text).toBe("yeah");
    expect(lines.find((l) => l.id === "b1")?.text).toBe("yeah");
  });

  it("skips detached lines", () => {
    seedTwoInstances();
    useProjectStore.setState((state) => ({
      lines: state.lines.map((l) => (l.id === "a1" ? { ...l, detached: true } : l)),
    }));

    useProjectStore.getState().propagateLinkedEdit("g1", 0, { text: "I really love you" });

    const lines = useProjectStore.getState().lines;
    expect(lines.find((l) => l.id === "a0")?.text).toBe("I really love you");
    expect(lines.find((l) => l.id === "a1")?.text).toBe("I love you");
  });

  it("does not touch lines from other groups", () => {
    seedTwoInstances();
    useProjectStore.setState((state) => ({
      lines: [
        ...state.lines,
        { id: "x", text: "verse line", agentId: "v1", groupId: "g2", instanceIdx: 0, templateLineIdx: 0 },
      ],
    }));

    useProjectStore.getState().propagateLinkedEdit("g1", 0, { text: "changed" });

    expect(useProjectStore.getState().lines.find((l) => l.id === "x")?.text).toBe("verse line");
  });
});

describe("project store · shiftInstance", () => {
  it("shifts begin/end on lines and words for the target instance only", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 30,
          end: 32,
          words: [
            { text: "hi ", begin: 30, end: 31 },
            { text: "there", begin: 31, end: 32 },
          ],
        },
        {
          id: "a1",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          begin: 60,
          end: 62,
          words: [
            { text: "hi ", begin: 60, end: 61 },
            { text: "there", begin: 61, end: 62 },
          ],
        },
      ],
    });

    useProjectStore.getState().shiftInstance("g1", 1, 5);

    const lines = useProjectStore.getState().lines;
    const i0 = lines.find((l) => l.id === "a0");
    const i1 = lines.find((l) => l.id === "a1");

    expect(i0?.begin).toBeCloseTo(30);
    expect(i0?.end).toBeCloseTo(32);
    expect(i0?.words?.[1].end).toBeCloseTo(32);

    expect(i1?.begin).toBeCloseTo(65);
    expect(i1?.end).toBeCloseTo(67);
    expect(i1?.words?.[0].begin).toBeCloseTo(65);
    expect(i1?.words?.[1].end).toBeCloseTo(67);
  });

  it("shifts background words too", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "yeah",
          backgroundWords: [{ text: "yeah", begin: 30, end: 31 }],
        },
      ],
    });

    useProjectStore.getState().shiftInstance("g1", 0, 2);

    const bg = useProjectStore.getState().lines[0].backgroundWords?.[0];
    expect(bg?.begin).toBeCloseTo(32);
    expect(bg?.end).toBeCloseTo(33);
  });

  it("is undoable", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 10,
          end: 11,
        },
      ],
    });
    useProjectStore.getState().clearHistory();

    useProjectStore.getState().shiftInstance("g1", 0, 5);
    expect(useProjectStore.getState().lines[0].begin).toBeCloseTo(15);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].begin).toBeCloseTo(10);
  });
});

describe("project store · updateLineWithHistory auto-propagation", () => {
  function seedTwoInstancesWithTimings() {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 30,
          end: 32,
        },
        {
          id: "a1",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          begin: 60,
          end: 62,
        },
      ],
    });
  }

  it("propagates text edits to linked siblings", () => {
    seedTwoInstancesWithTimings();
    useProjectStore.getState().updateLineWithHistory("a0", { text: "I really love you" });

    const lines = useProjectStore.getState().lines;
    expect(lines.find((l) => l.id === "a0")?.text).toBe("I really love you");
    expect(lines.find((l) => l.id === "a1")?.text).toBe("I really love you");
  });

  it("propagates agentId edits", () => {
    seedTwoInstancesWithTimings();
    useProjectStore.getState().updateLineWithHistory("a0", { agentId: "v1000" });

    const lines = useProjectStore.getState().lines;
    expect(lines.find((l) => l.id === "a0")?.agentId).toBe("v1000");
    expect(lines.find((l) => l.id === "a1")?.agentId).toBe("v1000");
  });

  it("does NOT propagate per-instance fields like begin/end", () => {
    seedTwoInstancesWithTimings();
    useProjectStore.getState().updateLineWithHistory("a0", { begin: 25, end: 27 });

    const lines = useProjectStore.getState().lines;
    expect(lines.find((l) => l.id === "a0")?.begin).toBe(25);
    expect(lines.find((l) => l.id === "a0")?.end).toBe(27);
    expect(lines.find((l) => l.id === "a1")?.begin).toBe(60);
    expect(lines.find((l) => l.id === "a1")?.end).toBe(62);
  });

  it("skips detached siblings", () => {
    seedTwoInstancesWithTimings();
    useProjectStore.setState((state) => ({
      lines: state.lines.map((l) => (l.id === "a1" ? { ...l, detached: true } : l)),
    }));

    useProjectStore.getState().updateLineWithHistory("a0", { text: "new text" });

    const lines = useProjectStore.getState().lines;
    expect(lines.find((l) => l.id === "a0")?.text).toBe("new text");
    expect(lines.find((l) => l.id === "a1")?.text).toBe("I love you");
  });

  it("does not affect lines from other groups", () => {
    seedTwoInstancesWithTimings();
    useProjectStore.setState((state) => ({
      lines: [
        ...state.lines,
        { id: "x", text: "other group", agentId: "v1", groupId: "g2", instanceIdx: 0, templateLineIdx: 0 },
      ],
    }));

    useProjectStore.getState().updateLineWithHistory("a0", { text: "changed" });

    expect(useProjectStore.getState().lines.find((l) => l.id === "x")?.text).toBe("other group");
  });

  it("standalone (non-grouped) edits work as before (regression)", () => {
    useProjectStore.setState({
      lines: [{ id: "s", text: "standalone", agentId: "v1" }],
    });

    useProjectStore.getState().updateLineWithHistory("s", { text: "edited" });

    expect(useProjectStore.getState().lines[0].text).toBe("edited");
  });

  it("propagates word text edits to siblings while preserving sibling timing", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { text: "I ", begin: 30, end: 30.4 },
            { text: "love ", begin: 30.4, end: 30.8 },
            { text: "you", begin: 30.8, end: 31.2 },
          ],
        },
        {
          id: "a1",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { text: "I ", begin: 60, end: 60.5 },
            { text: "love ", begin: 60.5, end: 61.0 },
            { text: "you", begin: 61.0, end: 61.5 },
          ],
        },
      ],
    });

    useProjectStore.getState().updateLineWithHistory("a0", {
      words: [
        { text: "I ", begin: 30, end: 30.4 },
        { text: "really ", begin: 30.4, end: 30.8 },
        { text: "you", begin: 30.8, end: 31.2 },
      ],
    });

    const lines = useProjectStore.getState().lines;
    const a1 = lines.find((l) => l.id === "a1");
    expect(a1?.words?.[1].text).toBe("really ");
    expect(a1?.words?.[1].begin).toBe(60.5);
    expect(a1?.words?.[1].end).toBe(61.0);
    expect(a1?.words?.[0].begin).toBe(60);
    expect(a1?.words?.[2].end).toBe(61.5);
  });

  it("propagates background word text edits to siblings", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "ohh ahh",
          backgroundWords: [
            { text: "ohh ", begin: 30, end: 30.5 },
            { text: "ahh", begin: 30.5, end: 31 },
          ],
        },
        {
          id: "a1",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          backgroundText: "ohh ahh",
          backgroundWords: [
            { text: "ohh ", begin: 60, end: 60.7 },
            { text: "ahh", begin: 60.7, end: 61.4 },
          ],
        },
      ],
    });

    useProjectStore.getState().updateLineWithHistory("a0", {
      backgroundWords: [
        { text: "ooh ", begin: 30, end: 30.5 },
        { text: "yeah", begin: 30.5, end: 31 },
      ],
    });

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.backgroundWords?.[0].text).toBe("ooh ");
    expect(a1?.backgroundWords?.[1].text).toBe("yeah");
    expect(a1?.backgroundWords?.[0].begin).toBe(60);
    expect(a1?.backgroundWords?.[1].end).toBe(61.4);
  });

  it("propagates word splits to siblings, scaling timing to sibling span", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "loving you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { text: "loving ", begin: 0, end: 1 },
            { text: "you", begin: 1, end: 2 },
          ],
        },
        {
          id: "a1",
          text: "loving you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { text: "loving ", begin: 10, end: 12 },
            { text: "you", begin: 12, end: 14 },
          ],
        },
      ],
    });

    useProjectStore.getState().updateLineWithHistory("a0", {
      words: [
        { text: "lov", begin: 0, end: 0.5 },
        { text: "ing ", begin: 0.5, end: 1 },
        { text: "you", begin: 1, end: 2 },
      ],
    });

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.words?.length).toBe(3);
    expect(a1?.words?.map((w) => w.text)).toEqual(["lov", "ing ", "you"]);
    expect(a1?.words?.[0].begin).toBe(10);
    expect(a1?.words?.[0].end).toBe(11);
    expect(a1?.words?.[1].begin).toBe(11);
    expect(a1?.words?.[1].end).toBe(12);
    expect(a1?.words?.[2].begin).toBe(12);
    expect(a1?.words?.[2].end).toBe(14);
  });

  it("propagates word merges (count decreases) to siblings", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "lov ing you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { text: "lov", begin: 0, end: 0.5 },
            { text: "ing ", begin: 0.5, end: 1 },
            { text: "you", begin: 1, end: 2 },
          ],
        },
        {
          id: "a1",
          text: "lov ing you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { text: "lov", begin: 10, end: 11 },
            { text: "ing ", begin: 11, end: 12 },
            { text: "you", begin: 12, end: 14 },
          ],
        },
      ],
    });

    useProjectStore.getState().updateLineWithHistory("a0", {
      words: [
        { text: "loving ", begin: 0, end: 1 },
        { text: "you", begin: 1, end: 2 },
      ],
    });

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.words?.length).toBe(2);
    expect(a1?.words?.map((w) => w.text)).toEqual(["loving ", "you"]);
    expect(a1?.words?.[0].begin).toBe(10);
    expect(a1?.words?.[0].end).toBe(12);
    expect(a1?.words?.[1].begin).toBe(12);
    expect(a1?.words?.[1].end).toBe(14);
  });

  it("does not propagate structural changes to detached siblings", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ text: "hi", begin: 0, end: 1 }],
        },
        {
          id: "a1",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          detached: true,
          words: [{ text: "hi", begin: 10, end: 11 }],
        },
      ],
    });

    useProjectStore.getState().updateLineWithHistory("a0", {
      words: [
        { text: "h", begin: 0, end: 0.5 },
        { text: "i", begin: 0.5, end: 1 },
      ],
    });

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.words?.length).toBe(1);
    expect(a1?.words?.[0].text).toBe("hi");
  });

  it("clears sibling words/begin/end when source explicitly clears them with a text edit", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 30,
          end: 32,
          words: [
            { text: "I ", begin: 30, end: 30.4 },
            { text: "love ", begin: 30.4, end: 30.8 },
            { text: "you", begin: 30.8, end: 31.2 },
          ],
        },
        {
          id: "a1",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          begin: 60,
          end: 62,
          words: [
            { text: "I ", begin: 60, end: 60.5 },
            { text: "love ", begin: 60.5, end: 61.0 },
            { text: "you", begin: 61.0, end: 61.5 },
          ],
        },
      ],
    });

    useProjectStore.getState().updateLineWithHistory("a0", {
      text: "I luv you",
      words: undefined,
      begin: undefined,
      end: undefined,
    });

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");
    expect(a0?.text).toBe("I luv you");
    expect(a0?.words).toBeUndefined();
    expect(a0?.begin).toBeUndefined();
    expect(a0?.end).toBeUndefined();
    expect(a1?.text).toBe("I luv you");
    expect(a1?.words).toBeUndefined();
    expect(a1?.begin).toBeUndefined();
    expect(a1?.end).toBeUndefined();
  });

  it("clears sibling backgroundWords when source clears them with a text edit", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "a0",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "ohh ahh",
          backgroundWords: [
            { text: "ohh ", begin: 30, end: 30.5 },
            { text: "ahh", begin: 30.5, end: 31 },
          ],
        },
        {
          id: "a1",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          backgroundText: "ohh ahh",
          backgroundWords: [
            { text: "ohh ", begin: 60, end: 60.5 },
            { text: "ahh", begin: 60.5, end: 61 },
          ],
        },
      ],
    });

    useProjectStore.getState().updateLineWithHistory("a0", {
      backgroundText: "yeah",
      backgroundWords: undefined,
    });

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.backgroundText).toBe("yeah");
    expect(a1?.backgroundWords).toBeUndefined();
  });
});
