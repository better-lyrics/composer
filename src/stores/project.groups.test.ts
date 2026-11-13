import type { LineTemplate, LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
/**
 * @vitest-environment node
 */
import { newWordId } from "@/domain/word/id";
import { useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { addGroupWithLines, removeGroup, updateGroup } from "@/domain/commands/group-edits";
import { addInstance, detachLine, removeInstance, shiftInstance } from "@/domain/commands/instance-edits";
import { pasteLines } from "@/domain/commands/instance-rows";
import { applyWordCountChange } from "@/domain/commands/word-edits";

const SONG_LENGTH = 300;

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

    useProjectStore
      .getState()
      .commit(
        pasteLyrics(useProjectStore.getState().lines, [{ id: "l1", text: "test", agentId: "v1", groupId: "g1" }]),
      );

    useProjectStore.setState({ groups: [] });

    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [{ id: "l2", text: "test2", agentId: "v1" }]));

    useProjectStore.getState().undo();

    expect(useProjectStore.getState().groups).toEqual(initialGroups);
  });

  it("redo restores the post-edit groups", () => {
    useProjectStore.setState({ groups: [seedGroup("g1")], lines: [] });

    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [{ id: "l1", text: "a", agentId: "v1" }]));

    useProjectStore.setState({ groups: [seedGroup("g1"), seedGroup("g2", { label: "Verse" })] });

    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [{ id: "l2", text: "b", agentId: "v1" }]));

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
            { id: "w1", text: "hi", sep: " ", begin: 0, end: 1 },
            { id: "w2", text: "there", sep: "", begin: 1, end: 2 },
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

    useProjectStore.getState().commit(
      addGroupWithLines(seedGroup("g1"), [
        { id: "l1", text: "a", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
        { id: "l2", text: "b", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 1 },
      ]),
    );

    expect(useProjectStore.getState().groups).toHaveLength(1);
    expect(useProjectStore.getState().lines[0].groupId).toBe("g1");

    useProjectStore.getState().undo();

    expect(useProjectStore.getState().groups).toHaveLength(0);
    expect(useProjectStore.getState().lines[0].groupId).toBeUndefined();
    expect(useProjectStore.getState().lines[1].groupId).toBeUndefined();
  });

  it("updateGroup merges fields", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.getState().commit(updateGroup("g1", { label: "Refrain", color: "#60a5fa" }));

    const g = useProjectStore.getState().groups[0];
    expect(g.label).toBe("Refrain");
    expect(g.color).toBe("#60a5fa");
    expect(g.templateVersion).toBe(1);
  });

  it("updateGroup leaves other groups untouched", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.getState().addGroup(seedGroup("g2", { label: "Verse" }));

    useProjectStore.getState().commit(updateGroup("g1", { label: "Refrain" }));

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

    useProjectStore.getState().commit(removeGroup("g1"));

    expect(useProjectStore.getState().groups).toHaveLength(0);
    expect(useProjectStore.getState().lines[0].groupId).toBeUndefined();
    expect(useProjectStore.getState().lines[0].instanceIdx).toBeUndefined();
    expect(useProjectStore.getState().lines[0].templateLineIdx).toBeUndefined();
    expect(lineText(useProjectStore.getState().lines[1])).toBe("untouched");
  });

  it("removeGroup is undoable (group + line fields restored together)", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore
      .getState()
      .commit(
        pasteLyrics(useProjectStore.getState().lines, [
          { id: "l1", text: "test", agentId: "v1", groupId: "g1", instanceIdx: 0, templateLineIdx: 0 },
        ]),
      );

    useProjectStore.getState().commit(removeGroup("g1"));
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
      words: words.map(([t, b, e]) => ({ id: newWordId(), text: t, sep: "", relativeBegin: b, relativeEnd: e })),
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

    useProjectStore.getState().commit(addInstance("g1", structure, 30));

    const created = useProjectStore.getState().lines.filter((l) => l.groupId === "g1");
    expect(created).toHaveLength(1);
    expect(created[0].instanceIdx).toBe(0);
    expect(created[0].templateLineIdx).toBe(0);
    expect(created[0].begin).toBeUndefined();
    expect(timedSyllables(mainTrack(created[0]))[0].begin).toBeCloseTo(30);
    expect(timedSyllables(mainTrack(created[0]))[1].begin).toBeCloseTo(30.4);
    expect(timedSyllables(mainTrack(created[0]))[2].end).toBeCloseTo(31.2);
  });

  it("addInstance carries backgroundText/backgroundWords/backgroundTextSource from the template", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const structure: LineTemplate[] = [
      {
        text: "main",
        agentId: "v1",
        words: [{ text: "main", sep: "", relativeBegin: 0, relativeEnd: 1 }],
        backgroundText: "ooh",
        backgroundWords: [{ text: "ooh", sep: "", relativeBegin: 0, relativeEnd: 0.5 }],
        backgroundTextSource: "extraction",
      },
    ];

    useProjectStore.getState().commit(addInstance("g1", structure, 30));

    const created = useProjectStore.getState().lines.filter((l) => l.groupId === "g1");
    expect(created).toHaveLength(1);
    expect(backgroundText(created[0])).toBe("ooh");
    expect(timedSyllables(backgroundTrack(created[0]))[0].begin).toBeCloseTo(30);
    expect(backgroundTrack(created[0])?.source).toBe("extraction");
  });

  it("addInstance carries a manual-sourced background flag", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const structure: LineTemplate[] = [
      {
        text: "main",
        agentId: "v1",
        words: [{ text: "main", sep: "", relativeBegin: 0, relativeEnd: 1 }],
        backgroundText: "ooh",
        backgroundTextSource: "manual",
      },
    ];

    useProjectStore.getState().commit(addInstance("g1", structure, 0));

    const created = useProjectStore.getState().lines.filter((l) => l.groupId === "g1");
    expect(backgroundTrack(created[0])?.source).toBe("manual");
  });

  it("addInstance leaves backgroundTextSource undefined for a template with no background", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const structure: LineTemplate[] = [templateOf("a", [["a", 0, 0.5]])];

    useProjectStore.getState().commit(addInstance("g1", structure, 0));

    const created = useProjectStore.getState().lines.filter((l) => l.groupId === "g1");
    expect(backgroundTrack(created[0])?.source).toBeUndefined();
  });

  it("addInstance picks the next unused instanceIdx", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const structure: LineTemplate[] = [templateOf("a", [["a", 0, 0.5]])];

    useProjectStore.getState().commit(addInstance("g1", structure, 10));
    useProjectStore.getState().commit(addInstance("g1", structure, 20));
    useProjectStore.getState().commit(addInstance("g1", structure, 30));

    const indices = useProjectStore
      .getState()
      .lines.flatMap((l) => (l.groupId === "g1" ? [l.instanceIdx] : []))
      .toSorted();
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

    useProjectStore.getState().commit(removeInstance("g1", 0));

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

    useProjectStore.getState().commit(removeInstance("g1", 0));

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
            { id: "w3", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w4", text: "love", sep: " ", begin: 30.4, end: 30.8 },
            { id: "w5", text: "you", sep: "", begin: 30.8, end: 31.2 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(detachLine("a"));

    const line = useProjectStore.getState().lines[0];
    expect(line.groupId).toBeUndefined();
    expect(line.instanceIdx).toBeUndefined();
    expect(line.templateLineIdx).toBeUndefined();
    expect(lineText(line)).toBe("I love you");
    expect(timedSyllables(mainTrack(line))[0].begin).toBeCloseTo(30);
  });

  it("instance mutators are undoable", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const structure: LineTemplate[] = [templateOf("a", [["a", 0, 0.5]])];
    useProjectStore.getState().commit(addInstance("g1", structure, 5));

    expect(useProjectStore.getState().lines).toHaveLength(1);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines).toHaveLength(0);
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
          words: [
            { id: "w6", text: "hi", sep: " ", begin: 30, end: 31 },
            { id: "w7", text: "there", sep: "", begin: 31, end: 32 },
          ],
        },
        {
          id: "a1",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w8", text: "hi", sep: " ", begin: 60, end: 61 },
            { id: "w9", text: "there", sep: "", begin: 61, end: 62 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(shiftInstance("g1", 1, 5, SONG_LENGTH));

    const lines = useProjectStore.getState().lines;
    const i0 = lines.find((l) => l.id === "a0");
    const i1 = lines.find((l) => l.id === "a1");

    expect(timedSyllables(mainTrack(i0!))[0].begin).toBeCloseTo(30);
    expect(timedSyllables(mainTrack(i0!))[1].end).toBeCloseTo(32);

    expect(timedSyllables(mainTrack(i1!))[0].begin).toBeCloseTo(65);
    expect(timedSyllables(mainTrack(i1!))[1].end).toBeCloseTo(67);
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
          backgroundWords: [{ id: "w10", text: "yeah", sep: "", begin: 30, end: 31 }],
        },
      ],
    });

    useProjectStore.getState().commit(shiftInstance("g1", 0, 2, SONG_LENGTH));

    const bg = useProjectStore.getState().lines[0].backgroundWords?.[0];
    expect(bg?.begin).toBeCloseTo(32);
    expect(bg?.end).toBeCloseTo(33);
  });

  it("regression: an instance shifted past zero stops there as a whole, keeping duration and background offset", () => {
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
          backgroundText: "yeah",
          backgroundWords: [{ id: "w11", text: "yeah", sep: "", begin: 10.25, end: 10.75 }],
        },
      ],
    });

    useProjectStore.getState().commit(shiftInstance("g1", 0, -10.5, SONG_LENGTH));

    expect(useProjectStore.getState().lines[0]).toMatchObject({
      begin: 0,
      end: 1,
      backgroundWords: [{ text: "yeah", sep: "", begin: 0.25, end: 0.75 }],
    });
  });

  it("regression: a multi-line instance shifted past zero moves every line by the same amount", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const member = { agentId: "v1", groupId: "g1", instanceIdx: 0 };
    useProjectStore.setState({
      lines: [
        { ...member, id: "a", text: "one", templateLineIdx: 0, begin: 0.5, end: 2.5 },
        { ...member, id: "b", text: "two", templateLineIdx: 1, begin: 3, end: 4 },
      ],
    });

    useProjectStore.getState().commit(shiftInstance("g1", 0, -2, SONG_LENGTH));

    const [a, b] = useProjectStore.getState().lines;
    expect(a).toMatchObject({ begin: 0, end: 2 });
    expect(b).toMatchObject({ begin: 2.5, end: 3.5 });
  });

  it("regression: an instance shifted past the song end stops there as a whole", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    const member = { agentId: "v1", groupId: "g1", instanceIdx: 0 };
    useProjectStore.setState({
      lines: [
        { ...member, id: "a", text: "one", templateLineIdx: 0, begin: 100, end: 102 },
        { ...member, id: "b", text: "two", templateLineIdx: 1, begin: 103, end: 105 },
      ],
    });

    useProjectStore.getState().commit(shiftInstance("g1", 0, 20, 110));

    const [a, b] = useProjectStore.getState().lines;
    expect(a).toMatchObject({ begin: 105, end: 107 });
    expect(b).toMatchObject({ begin: 108, end: 110 });
  });

  it("edge case: shifts without an end limit while the song length is unknown", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          id: "a",
          text: "one",
          templateLineIdx: 0,
          begin: 100,
          end: 102,
        },
      ],
    });

    useProjectStore.getState().commit(shiftInstance("g1", 0, 20, 0));

    expect(useProjectStore.getState().lines[0]).toMatchObject({ begin: 120, end: 122 });
  });

  it("regression: adds no undo step when the song end leaves no room to move", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          id: "a",
          text: "one",
          templateLineIdx: 0,
          begin: 100,
          end: 110,
        },
      ],
    });
    useProjectStore.getState().clearHistory();
    const historyBefore = useProjectStore.getState().history;

    useProjectStore.getState().commit(shiftInstance("g1", 0, 5, 110));

    expect(useProjectStore.getState().history).toBe(historyBefore);
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

    useProjectStore.getState().commit(shiftInstance("g1", 0, 5, SONG_LENGTH));
    expect(useProjectStore.getState().lines[0].begin).toBeCloseTo(15);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().lines[0].begin).toBeCloseTo(10);
  });

  it("does not shift a line whose link metadata still matches but detached=true (defense-in-depth)", () => {
    useProjectStore.getState().addGroup(seedGroup("g1"));
    useProjectStore.setState({
      lines: [
        {
          id: "live",
          text: "x",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w12", text: "x", sep: "", begin: 10, end: 11 }],
        },
        {
          id: "stale-detached",
          text: "y",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 1,
          detached: true,
          words: [{ id: "w13", text: "y", sep: "", begin: 10, end: 11 }],
        },
      ],
    });
    useProjectStore.getState().clearHistory();

    useProjectStore.getState().commit(shiftInstance("g1", 0, 0.5, SONG_LENGTH));
    const after = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(after.find((l) => l.id === "live")!))[0].begin).toBeCloseTo(10.5);
    expect(timedSyllables(mainTrack(after.find((l) => l.id === "stale-detached")!))[0].begin).toBeCloseTo(10);
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
    useProjectStore.getState().commit(pasteLines([{ id: "a0", updates: { text: "I really love you" } }]));

    const lines = useProjectStore.getState().lines;
    expect(lineText(lines.find((l) => l.id === "a0")!)).toBe("I really love you");
    expect(lineText(lines.find((l) => l.id === "a1")!)).toBe("I really love you");
  });

  it("propagates agentId edits", () => {
    seedTwoInstancesWithTimings();
    useProjectStore.getState().commit(pasteLines([{ id: "a0", updates: { agentId: "v1000" } }]));

    const lines = useProjectStore.getState().lines;
    expect(lines.find((l) => l.id === "a0")?.agentId).toBe("v1000");
    expect(lines.find((l) => l.id === "a1")?.agentId).toBe("v1000");
  });

  it("does NOT propagate per-instance fields like begin/end", () => {
    seedTwoInstancesWithTimings();
    useProjectStore.getState().commit(pasteLines([{ id: "a0", updates: { begin: 25, end: 27 } }]));

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

    useProjectStore.getState().commit(pasteLines([{ id: "a0", updates: { text: "new text" } }]));

    const lines = useProjectStore.getState().lines;
    expect(lineText(lines.find((l) => l.id === "a0")!)).toBe("new text");
    expect(lineText(lines.find((l) => l.id === "a1")!)).toBe("I love you");
  });

  it("does not affect lines from other groups", () => {
    seedTwoInstancesWithTimings();
    useProjectStore.setState((state) => ({
      lines: [
        ...state.lines,
        { id: "x", text: "other group", agentId: "v1", groupId: "g2", instanceIdx: 0, templateLineIdx: 0 },
      ],
    }));

    useProjectStore.getState().commit(pasteLines([{ id: "a0", updates: { text: "changed" } }]));

    expect(lineText(useProjectStore.getState().lines.find((l) => l.id === "x")!)).toBe("other group");
  });

  it("standalone (non-grouped) edits work as before (regression)", () => {
    useProjectStore.setState({
      lines: [{ id: "s", text: "standalone", agentId: "v1" }],
    });

    useProjectStore.getState().commit(pasteLines([{ id: "s", updates: { text: "edited" } }]));

    expect(lineText(useProjectStore.getState().lines[0])).toBe("edited");
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
            { id: "w14", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w15", text: "love", sep: " ", begin: 30.4, end: 30.8 },
            { id: "w16", text: "you", sep: "", begin: 30.8, end: 31.2 },
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
            { id: "w17", text: "I", sep: " ", begin: 60, end: 60.5 },
            { id: "w18", text: "love", sep: " ", begin: 60.5, end: 61.0 },
            { id: "w19", text: "you", sep: "", begin: 61.0, end: 61.5 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: {
            words: [
              { id: "w20", text: "I", sep: " ", begin: 30, end: 30.4 },
              { id: "w21", text: "really", sep: " ", begin: 30.4, end: 30.8 },
              { id: "w22", text: "you", sep: "", begin: 30.8, end: 31.2 },
            ],
          },
        },
      ]),
    );

    const lines = useProjectStore.getState().lines;
    const a1 = lines.find((l) => l.id === "a1");
    expect(timedSyllables(mainTrack(a1!))[1]).toMatchObject({ text: "really", sep: " " });
    expect(timedSyllables(mainTrack(a1!))[1].begin).toBe(60.5);
    expect(timedSyllables(mainTrack(a1!))[1].end).toBe(61.0);
    expect(timedSyllables(mainTrack(a1!))[0].begin).toBe(60);
    expect(timedSyllables(mainTrack(a1!))[2].end).toBe(61.5);
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
            { id: "w23", text: "ohh", sep: " ", begin: 30, end: 30.5 },
            { id: "w24", text: "ahh", sep: "", begin: 30.5, end: 31 },
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
            { id: "w25", text: "ohh", sep: " ", begin: 60, end: 60.7 },
            { id: "w26", text: "ahh", sep: "", begin: 60.7, end: 61.4 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: {
            backgroundWords: [
              { id: "w27", text: "ooh", sep: " ", begin: 30, end: 30.5 },
              { id: "w28", text: "yeah", sep: "", begin: 30.5, end: 31 },
            ],
          },
        },
      ]),
    );

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(timedSyllables(backgroundTrack(a1!))[0]).toMatchObject({ text: "ooh", sep: " " });
    expect(timedSyllables(backgroundTrack(a1!))[1].text).toBe("yeah");
    expect(timedSyllables(backgroundTrack(a1!))[0].begin).toBe(60);
    expect(timedSyllables(backgroundTrack(a1!))[1].end).toBe(61.4);
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
            { id: "w29", text: "loving", sep: " ", begin: 0, end: 1 },
            { id: "w30", text: "you", sep: "", begin: 1, end: 2 },
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
            { id: "w31", text: "loving", sep: " ", begin: 10, end: 12 },
            { id: "w32", text: "you", sep: "", begin: 12, end: 14 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: {
            words: [
              { id: "w33", text: "lov", sep: "", begin: 0, end: 0.5 },
              { id: "w34", text: "ing", sep: " ", begin: 0.5, end: 1 },
              { id: "w35", text: "you", sep: "", begin: 1, end: 2 },
            ],
          },
        },
      ]),
    );

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.words?.length).toBe(3);
    expect(timedSyllables(mainTrack(a1!)).map((w) => w.text + w.sep)).toEqual(["lov", "ing ", "you"]);
    expect(timedSyllables(mainTrack(a1!))[0].begin).toBe(10);
    expect(timedSyllables(mainTrack(a1!))[0].end).toBe(11);
    expect(timedSyllables(mainTrack(a1!))[1].begin).toBe(11);
    expect(timedSyllables(mainTrack(a1!))[1].end).toBe(12);
    expect(timedSyllables(mainTrack(a1!))[2].begin).toBe(12);
    expect(timedSyllables(mainTrack(a1!))[2].end).toBe(14);
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
            { id: "w36", text: "lov", sep: "", begin: 0, end: 0.5 },
            { id: "w37", text: "ing", sep: " ", begin: 0.5, end: 1 },
            { id: "w38", text: "you", sep: "", begin: 1, end: 2 },
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
            { id: "w39", text: "lov", sep: "", begin: 10, end: 11 },
            { id: "w40", text: "ing", sep: " ", begin: 11, end: 12 },
            { id: "w41", text: "you", sep: "", begin: 12, end: 14 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: {
            words: [
              { id: "w42", text: "loving", sep: " ", begin: 0, end: 1 },
              { id: "w43", text: "you", sep: "", begin: 1, end: 2 },
            ],
          },
        },
      ]),
    );

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.words?.length).toBe(2);
    expect(timedSyllables(mainTrack(a1!)).map((w) => w.text + w.sep)).toEqual(["loving ", "you"]);
    expect(timedSyllables(mainTrack(a1!))[0].begin).toBe(10);
    expect(timedSyllables(mainTrack(a1!))[0].end).toBe(12);
    expect(timedSyllables(mainTrack(a1!))[1].begin).toBe(12);
    expect(timedSyllables(mainTrack(a1!))[1].end).toBe(14);
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
          words: [{ id: "w44", text: "hi", sep: "", begin: 0, end: 1 }],
        },
        {
          id: "a1",
          text: "hi",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          detached: true,
          words: [{ id: "w45", text: "hi", sep: "", begin: 10, end: 11 }],
        },
      ],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: {
            words: [
              { id: "w46", text: "h", sep: "", begin: 0, end: 0.5 },
              { id: "w47", text: "i", sep: "", begin: 0.5, end: 1 },
            ],
          },
        },
      ]),
    );

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(a1?.words?.length).toBe(1);
    expect(timedSyllables(mainTrack(a1!))[0].text).toBe("hi");
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
          words: [
            { id: "w48", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w49", text: "love", sep: " ", begin: 30.4, end: 30.8 },
            { id: "w50", text: "you", sep: "", begin: 30.8, end: 31.2 },
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
            { id: "w51", text: "I", sep: " ", begin: 60, end: 60.5 },
            { id: "w52", text: "love", sep: " ", begin: 60.5, end: 61.0 },
            { id: "w53", text: "you", sep: "", begin: 61.0, end: 61.5 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: {
            text: "I luv you",
            words: undefined,
            begin: undefined,
            end: undefined,
          },
        },
      ]),
    );

    const lines = useProjectStore.getState().lines;
    const a0 = lines.find((l) => l.id === "a0");
    const a1 = lines.find((l) => l.id === "a1");
    expect(lineText(a0!)).toBe("I luv you");
    expect(a0?.words).toBeUndefined();
    expect(a0?.begin).toBeUndefined();
    expect(a0?.end).toBeUndefined();
    expect(lineText(a1!)).toBe("I luv you");
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
            { id: "w54", text: "ohh", sep: " ", begin: 30, end: 30.5 },
            { id: "w55", text: "ahh", sep: "", begin: 30.5, end: 31 },
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
            { id: "w56", text: "ohh", sep: " ", begin: 60, end: 60.5 },
            { id: "w57", text: "ahh", sep: "", begin: 60.5, end: 61 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "a0",
          updates: {
            backgroundText: "yeah",
            backgroundWords: undefined,
          },
        },
      ]),
    );

    const a1 = useProjectStore.getState().lines.find((l) => l.id === "a1");
    expect(backgroundText(a1!)).toBe("yeah");
    expect(a1?.backgroundWords).toBeUndefined();
  });
});

// -- Smart word-count propagation regression tests ----------------------------
//
// These pin the fix for the silent-retiming bug. Before the fix, a split or
// merge on chorus 1 would proportionally rewrite every sibling's per-word
// timing, including words that didn't structurally change. Smart propagation
// preserves the timing of unchanged words on each sibling.

describe("propagateWordChanges · smart sync preserves unchanged-word timing", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
  });

  it("split on source: sibling 'I' and 'you' keep their original begin/end (different rhythm than source)", () => {
    useProjectStore.setState({
      lines: [
        {
          id: "A",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w58", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w59", text: "love", sep: " ", begin: 0.3, end: 0.6 },
            { id: "w60", text: "you", sep: "", begin: 0.6, end: 1 },
          ],
        },
        {
          id: "B",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            // Sibling B has DIFFERENT rhythm from source A
            { id: "w61", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w62", text: "love", sep: " ", begin: 30.4, end: 30.7 },
            { id: "w63", text: "you", sep: "", begin: 30.7, end: 31.2 },
          ],
        },
      ],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "A",
          updates: {
            words: [
              { id: "w64", text: "I", sep: " ", begin: 0, end: 0.3 },
              { id: "w65", text: "lo", sep: "", begin: 0.3, end: 0.45 },
              { id: "w66", text: "ve", sep: " ", begin: 0.45, end: 0.6 },
              { id: "w67", text: "you", sep: "", begin: 0.6, end: 1 },
            ],
          },
        },
      ]),
    );

    const b = useProjectStore.getState().lines.find((l) => l.id === "B");
    expect(timedSyllables(mainTrack(b!))).toHaveLength(4);
    // Sibling B's "I" preserved exactly
    expect(timedSyllables(mainTrack(b!))[0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4 });
    // Sibling B's "you" preserved exactly
    expect(timedSyllables(mainTrack(b!))[3]).toEqual({ text: "you", sep: "", begin: 30.7, end: 31.2 });
    // The split lands inside B's love-slot proportionally
    expect(timedSyllables(mainTrack(b!))[1].text).toBe("lo");
    expect(timedSyllables(mainTrack(b!))[1].begin).toBeCloseTo(30.4);
    expect(timedSyllables(mainTrack(b!))[1].end).toBeCloseTo(30.55);
    expect(timedSyllables(mainTrack(b!))[2]).toMatchObject({ text: "ve", sep: " " });
    expect(timedSyllables(mainTrack(b!))[2].begin).toBeCloseTo(30.55);
    expect(timedSyllables(mainTrack(b!))[2].end).toBeCloseTo(30.7);
  });

  it("merge on source: sibling unchanged words keep their original timings", () => {
    useProjectStore.setState({
      lines: [
        {
          id: "A",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w68", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w69", text: "love", sep: " ", begin: 0.3, end: 0.6 },
            { id: "w70", text: "you", sep: "", begin: 0.6, end: 1 },
          ],
        },
        {
          id: "B",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w71", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w72", text: "love", sep: " ", begin: 30.4, end: 30.7 },
            { id: "w73", text: "you", sep: "", begin: 30.7, end: 31.2 },
          ],
        },
      ],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "A",
          updates: {
            words: [
              { id: "w74", text: "I", sep: " ", begin: 0, end: 0.3 },
              { id: "w75", text: "loveyou", sep: "", begin: 0.3, end: 1 },
            ],
          },
        },
      ]),
    );

    const b = useProjectStore.getState().lines.find((l) => l.id === "B");
    expect(timedSyllables(mainTrack(b!))).toHaveLength(2);
    expect(timedSyllables(mainTrack(b!))[0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4 });
    expect(timedSyllables(mainTrack(b!))[1]).toEqual({ text: "loveyou", sep: "", begin: 30.4, end: 31.2 });
  });

  it("identical-rhythm siblings: unchanged-word timing preserved (matches source rhythm)", () => {
    useProjectStore.setState({
      lines: [
        {
          id: "A",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w76", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w77", text: "love", sep: " ", begin: 0.3, end: 0.6 },
            { id: "w78", text: "you", sep: "", begin: 0.6, end: 1 },
          ],
        },
        {
          id: "B",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w79", text: "I", sep: " ", begin: 30, end: 30.3 },
            { id: "w80", text: "love", sep: " ", begin: 30.3, end: 30.6 },
            { id: "w81", text: "you", sep: "", begin: 30.6, end: 31 },
          ],
        },
      ],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "A",
          updates: {
            words: [
              { id: "w82", text: "I", sep: " ", begin: 0, end: 0.3 },
              { id: "w83", text: "lo", sep: "", begin: 0.3, end: 0.45 },
              { id: "w84", text: "ve", sep: " ", begin: 0.45, end: 0.6 },
              { id: "w85", text: "you", sep: "", begin: 0.6, end: 1 },
            ],
          },
        },
      ]),
    );

    const b = useProjectStore.getState().lines.find((l) => l.id === "B");
    expect(timedSyllables(mainTrack(b!))).toHaveLength(4);
    expect(timedSyllables(mainTrack(b!))[0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.3 });
    expect(timedSyllables(mainTrack(b!))[3]).toEqual({ text: "you", sep: "", begin: 30.6, end: 31 });
  });

  it("BG word split on source: sibling BG words preserve unchanged-word timings", () => {
    useProjectStore.setState({
      lines: [
        {
          id: "A",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "ah ah",
          backgroundWords: [
            { id: "w86", text: "ah", sep: " ", begin: 0, end: 0.3 },
            { id: "w87", text: "ah", sep: "", begin: 0.3, end: 0.6 },
          ],
        },
        {
          id: "B",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          backgroundText: "ah ah",
          backgroundWords: [
            { id: "w88", text: "ah", sep: " ", begin: 30, end: 30.4 },
            { id: "w89", text: "ah", sep: "", begin: 30.4, end: 30.8 },
          ],
        },
      ],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "A",
          updates: {
            backgroundWords: [
              { id: "w90", text: "ah", sep: " ", begin: 0, end: 0.3 },
              { id: "w91", text: "a", sep: "", begin: 0.3, end: 0.45 },
              { id: "w92", text: "h", sep: "", begin: 0.45, end: 0.6 },
            ],
          },
        },
      ]),
    );

    const b = useProjectStore.getState().lines.find((l) => l.id === "B");
    expect(timedSyllables(backgroundTrack(b!))).toHaveLength(3);
    // First "ah" preserved on sibling B
    expect(timedSyllables(backgroundTrack(b!))[0]).toEqual({ text: "ah", sep: " ", begin: 30, end: 30.4 });
    // The new "a" + "h" split inside B's old second-ah slot
    expect(timedSyllables(backgroundTrack(b!))[1].text).toBe("a");
    expect(timedSyllables(backgroundTrack(b!))[1].begin).toBeCloseTo(30.4);
    expect(timedSyllables(backgroundTrack(b!))[1].end).toBeCloseTo(30.6);
    expect(timedSyllables(backgroundTrack(b!))[2].text).toBe("h");
    expect(timedSyllables(backgroundTrack(b!))[2].begin).toBeCloseTo(30.6);
    expect(timedSyllables(backgroundTrack(b!))[2].end).toBeCloseTo(30.8);
  });

  it("detached siblings are NOT touched by structural propagation", () => {
    useProjectStore.setState({
      lines: [
        {
          id: "A",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w93", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w94", text: "love", sep: " ", begin: 0.3, end: 0.6 },
            { id: "w95", text: "you", sep: "", begin: 0.6, end: 1 },
          ],
        },
        {
          id: "B",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          detached: true,
          words: [
            { id: "w96", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w97", text: "love", sep: " ", begin: 30.4, end: 30.7 },
            { id: "w98", text: "you", sep: "", begin: 30.7, end: 31.2 },
          ],
        },
      ],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    });

    useProjectStore.getState().commit(
      pasteLines([
        {
          id: "A",
          updates: {
            words: [
              { id: "w99", text: "I", sep: " ", begin: 0, end: 0.3 },
              { id: "w100", text: "lo", sep: "", begin: 0.3, end: 0.45 },
              { id: "w101", text: "ve", sep: " ", begin: 0.45, end: 0.6 },
              { id: "w102", text: "you", sep: "", begin: 0.6, end: 1 },
            ],
          },
        },
      ]),
    );

    const b = useProjectStore.getState().lines.find((l) => l.id === "B");
    // Detached sibling untouched: original 3-word array preserved
    expect(timedSyllables(mainTrack(b!))).toHaveLength(3);
    expect(timedSyllables(mainTrack(b!))[1]).toMatchObject({ text: "love", sep: " " });
    expect(b?.detached).toBe(true);
  });
});

// -- applyWordCountChange mutator (modal resolutions) -------------------------

describe("applyWordCountChange · resolutions", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
  });

  function setupChorus() {
    useProjectStore.setState({
      lines: [
        {
          id: "A",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w103", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w104", text: "love", sep: " ", begin: 0.3, end: 0.6 },
            { id: "w105", text: "you", sep: "", begin: 0.6, end: 1 },
          ],
        },
        {
          id: "B",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w106", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w107", text: "love", sep: " ", begin: 30.4, end: 30.7 },
            { id: "w108", text: "you", sep: "", begin: 30.7, end: 31.2 },
          ],
        },
      ],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    });
  }

  const splitWords = [
    { id: "w109", text: "I", sep: " ", begin: 0, end: 0.3 },
    { id: "w110", text: "lo", sep: "", begin: 0.3, end: 0.45 },
    { id: "w111", text: "ve", sep: " ", begin: 0.45, end: 0.6 },
    { id: "w112", text: "you", sep: "", begin: 0.6, end: 1 },
  ];

  it("'apply' propagates the structural change with smart-sync to all linked siblings", () => {
    setupChorus();
    useProjectStore.getState().commit(applyWordCountChange("A", splitWords, "words", "apply"));
    const after = useProjectStore.getState().lines;
    const a = after.find((l) => l.id === "A");
    const b = after.find((l) => l.id === "B");
    expect(timedSyllables(mainTrack(a!))).toHaveLength(4);
    expect(timedSyllables(mainTrack(b!))).toHaveLength(4);
    // Sibling B's "I" and "you" preserved
    expect(timedSyllables(mainTrack(b!))[0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4 });
    expect(timedSyllables(mainTrack(b!))[3]).toEqual({ text: "you", sep: "", begin: 30.7, end: 31.2 });
    // Neither is detached
    expect(a?.detached).toBeUndefined();
    expect(b?.detached).toBeUndefined();
  });

  it("'detach' fully unlinks source (clears groupId/instanceIdx/templateLineIdx) and leaves siblings untouched", () => {
    setupChorus();
    useProjectStore.getState().commit(applyWordCountChange("A", splitWords, "words", "detach"));
    const after = useProjectStore.getState().lines;
    const a = after.find((l) => l.id === "A");
    const b = after.find((l) => l.id === "B");
    expect(a?.groupId).toBeUndefined();
    expect(a?.instanceIdx).toBeUndefined();
    expect(a?.templateLineIdx).toBeUndefined();
    expect(a?.detached).toBeUndefined();
    expect(timedSyllables(mainTrack(a!))).toHaveLength(4);
    expect(timedSyllables(mainTrack(b!))).toHaveLength(3);
    expect(timedSyllables(mainTrack(b!))[0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4 });
  });

  it("'detach' clears stale begin/end when promoting a line-synced row to word-synced", () => {
    useProjectStore.setState({
      lines: [
        {
          id: "L1",
          text: "verse",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 5,
          end: 7,
        },
        {
          id: "L2",
          text: "verse",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          begin: 30,
          end: 32,
        },
      ],
      groups: [{ id: "g1", label: "Verse", color: "#aaa", templateVersion: 1 }],
    });
    const newWords = [{ id: "w113", text: "verse", sep: "", begin: 5, end: 7 }];
    useProjectStore.getState().commit(applyWordCountChange("L1", newWords, "words", "detach"));
    const after = useProjectStore.getState().lines.find((l) => l.id === "L1");
    expect(timedSyllables(mainTrack(after!))).toEqual(newWords);
    expect(after?.begin).toBeUndefined();
    expect(after?.end).toBeUndefined();
  });

  it("'cancel' is a no-op", () => {
    setupChorus();
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().commit(applyWordCountChange("A", splitWords, "words", "cancel"));
    expect(useProjectStore.getState().lines).toEqual(before);
  });

  it("apply with extraUpdates: text propagates as a linked field to siblings", () => {
    setupChorus();
    const mergedWords = [
      { id: "w114", text: "I", sep: " ", begin: 0, end: 0.3 },
      { id: "w115", text: "loveyou", sep: "", begin: 0.3, end: 1 },
    ];
    useProjectStore.getState().commit(applyWordCountChange("A", mergedWords, "words", "apply", { text: "I loveyou" }));
    const after = useProjectStore.getState().lines;
    expect(lineText(after.find((l) => l.id === "A")!)).toBe("I loveyou");
    expect(lineText(after.find((l) => l.id === "B")!)).toBe("I loveyou");
  });

  it("detach with extraUpdates: text only changes on source, not siblings", () => {
    setupChorus();
    const mergedWords = [
      { id: "w116", text: "I", sep: " ", begin: 0, end: 0.3 },
      { id: "w117", text: "loveyou", sep: "", begin: 0.3, end: 1 },
    ];
    useProjectStore.getState().commit(applyWordCountChange("A", mergedWords, "words", "detach", { text: "I loveyou" }));
    const after = useProjectStore.getState().lines;
    expect(lineText(after.find((l) => l.id === "A")!)).toBe("I loveyou");
    expect(lineText(after.find((l) => l.id === "B")!)).toBe("I love you"); // unchanged
  });

  it("detached siblings are skipped on apply", () => {
    setupChorus();
    // Mark B detached upfront
    useProjectStore.setState((s) => ({
      lines: s.lines.map((l) => (l.id === "B" ? { ...l, detached: true } : l)),
    }));
    useProjectStore.getState().commit(applyWordCountChange("A", splitWords, "words", "apply"));
    const b = useProjectStore.getState().lines.find((l) => l.id === "B");
    expect(timedSyllables(mainTrack(b!))).toHaveLength(3); // untouched, still 3 words
    expect(b?.detached).toBe(true);
  });

  it("non-linked source: apply just writes to source, no siblings touched", () => {
    useProjectStore.setState({
      lines: [
        {
          id: "X",
          text: "I love",
          agentId: "v1",
          words: [
            { id: "w118", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w119", text: "love", sep: "", begin: 0.3, end: 1 },
          ],
        },
      ],
      groups: [],
    });
    useProjectStore.getState().commit(
      applyWordCountChange(
        "X",
        [
          { id: "w120", text: "I", sep: " ", begin: 0, end: 0.3 },
          { id: "w121", text: "lo", sep: "", begin: 0.3, end: 0.6 },
          { id: "w122", text: "ve", sep: "", begin: 0.6, end: 1 },
        ],
        "words",
        "apply",
      ),
    );
    const x = useProjectStore.getState().lines.find((l) => l.id === "X");
    expect(timedSyllables(mainTrack(x!))).toHaveLength(3);
  });

  it("backgroundWords field: 'apply' propagates BG structural change with smart-sync", () => {
    useProjectStore.setState({
      lines: [
        {
          id: "A",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "ah ah",
          backgroundWords: [
            { id: "w123", text: "ah", sep: " ", begin: 0, end: 0.3 },
            { id: "w124", text: "ah", sep: "", begin: 0.3, end: 0.6 },
          ],
        },
        {
          id: "B",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          backgroundText: "ah ah",
          backgroundWords: [
            { id: "w125", text: "ah", sep: " ", begin: 30, end: 30.4 },
            { id: "w126", text: "ah", sep: "", begin: 30.4, end: 30.8 },
          ],
        },
      ],
      groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    });
    useProjectStore.getState().commit(
      applyWordCountChange(
        "A",
        [
          { id: "w127", text: "ah", sep: " ", begin: 0, end: 0.3 },
          { id: "w128", text: "a", sep: "", begin: 0.3, end: 0.45 },
          { id: "w129", text: "h", sep: "", begin: 0.45, end: 0.6 },
        ],
        "backgroundWords",
        "apply",
      ),
    );
    const b = useProjectStore.getState().lines.find((l) => l.id === "B");
    expect(timedSyllables(backgroundTrack(b!))).toHaveLength(3);
    expect(timedSyllables(backgroundTrack(b!))[0]).toEqual({ text: "ah", sep: " ", begin: 30, end: 30.4 });
  });

  it("apply produces a single history entry covering source + all siblings (single undo restores)", () => {
    setupChorus();
    useProjectStore.getState().commit(applyWordCountChange("A", splitWords, "words", "apply"));
    const before = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(before.find((l) => l.id === "A")!))).toHaveLength(4);
    expect(timedSyllables(mainTrack(before.find((l) => l.id === "B")!))).toHaveLength(4);
    useProjectStore.getState().undo();
    const after = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(after.find((l) => l.id === "A")!))).toHaveLength(3);
    expect(timedSyllables(mainTrack(after.find((l) => l.id === "B")!))).toHaveLength(3);
  });
});
