/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import { setBackground } from "@/domain/line/background";
import { bgBounds } from "@/domain/line/bounds";
import { type LooseLine, reconcileLine } from "@/domain/line/model";
import { bgVoice, bgWords, lineText, mainWords } from "@/domain/line/voices";
import { useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedGroup(id: string): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1 };
}

function seed(lines: LooseLine[], groups: LinkGroup[] = []) {
  useProjectStore.setState({
    groups,
    lines: lines.map(reconcileLine),
    isDirtySinceHistory: true,
  });
}

function getLine(id: string) {
  const line = useProjectStore.getState().lines.find((l) => l.id === id);
  if (!line) throw new Error(`line ${id} not found`);
  return line;
}

describe("project store · removeLineBackground · clears every bg state", () => {
  it("removes an untimed background", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", backgroundText: "ooh" }]);
    expect(bgVoice(getLine("L1"))).not.toBeNull();

    useProjectStore.getState().removeLineBackground("L1");

    expect(bgVoice(getLine("L1"))).toBeNull();
  });

  it("removes a word-synced background", () => {
    seed([
      {
        id: "L1",
        text: "Real line",
        agentId: "v1",
        words: [{ text: "Real line", begin: 0, end: 2 }],
        backgroundText: "ooh aah",
        backgroundWords: [
          { text: "ooh ", begin: 1, end: 1.5 },
          { text: "aah", begin: 1.5, end: 2 },
        ],
        backgroundTextSource: "extraction",
      },
    ]);
    expect(bgWords(getLine("L1"))).toHaveLength(2);

    useProjectStore.getState().removeLineBackground("L1");

    expect(bgVoice(getLine("L1"))).toBeNull();
    expect(bgWords(getLine("L1"))).toBeUndefined();
  });

  it("removes a line-synced background", () => {
    const main = reconcileLine({
      id: "L1",
      text: "lead",
      agentId: "v1",
      words: [{ text: "lead", begin: 0, end: 2 }],
    });
    const withLineSyncedBg = setBackground(main, { text: "(ahh)", begin: 3.5, end: 4.5, source: "manual" });
    useProjectStore.setState({ lines: [withLineSyncedBg], isDirtySinceHistory: true });
    expect(bgBounds(getLine("L1"))).toEqual({ begin: 3.5, end: 4.5 });

    useProjectStore.getState().removeLineBackground("L1");

    expect(bgVoice(getLine("L1"))).toBeNull();
    expect(bgBounds(getLine("L1"))).toBeNull();
  });

  it("keeps the main voice text and timing intact after removal", () => {
    seed([
      {
        id: "L1",
        text: "Real line",
        agentId: "v1",
        words: [
          { text: "Real ", begin: 0, end: 1 },
          { text: "line", begin: 1, end: 2 },
        ],
        backgroundText: "ooh",
      },
    ]);

    useProjectStore.getState().removeLineBackground("L1");

    const after = getLine("L1");
    expect(bgVoice(after)).toBeNull();
    expect(lineText(after)).toBe("Real line");
    expect(mainWords(after)).toEqual([
      { text: "Real ", begin: 0, end: 1 },
      { text: "line", begin: 1, end: 2 },
    ]);
  });
});

describe("project store · removeLineBackground · history", () => {
  it("pushes one history entry and undo restores the exact prior background", () => {
    seed([
      {
        id: "L1",
        text: "Real line",
        agentId: "v1",
        words: [{ text: "Real line", begin: 0, end: 2 }],
        backgroundText: "ooh aah",
        backgroundWords: [
          { text: "ooh ", begin: 1, end: 1.5 },
          { text: "aah", begin: 1.5, end: 2 },
        ],
        backgroundTextSource: "extraction",
      },
    ]);
    const backgroundBefore = getLine("L1").background;
    expect(useProjectStore.getState().canUndo()).toBe(false);

    useProjectStore.getState().removeLineBackground("L1");
    expect(bgVoice(getLine("L1"))).toBeNull();
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();

    expect(getLine("L1").background).toEqual(backgroundBefore);
  });
});

describe("project store · removeLineBackground · linked siblings", () => {
  function seedLinkedPair() {
    seed(
      [
        {
          id: "a0",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "ooh ooh",
          backgroundTextSource: "manual",
        },
        {
          id: "a1",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          backgroundText: "ooh ooh",
          backgroundTextSource: "manual",
        },
      ],
      [seedGroup("g1")],
    );
  }

  it("clears the background on both linked instances by default", () => {
    seedLinkedPair();
    expect(bgVoice(getLine("a0"))).not.toBeNull();
    expect(bgVoice(getLine("a1"))).not.toBeNull();

    useProjectStore.getState().removeLineBackground("a0");

    expect(bgVoice(getLine("a0"))).toBeNull();
    expect(bgVoice(getLine("a1"))).toBeNull();
  });

  it("clears only the target when propagateToSiblings is false", () => {
    seedLinkedPair();

    useProjectStore.getState().removeLineBackground("a0", { propagateToSiblings: false });

    expect(bgVoice(getLine("a0"))).toBeNull();
    expect(bgVoice(getLine("a1"))).not.toBeNull();
  });

  it("leaves a detached sibling untouched even with default propagation", () => {
    seed(
      [
        {
          id: "a0",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "ooh ooh",
          backgroundTextSource: "manual",
        },
        {
          id: "a1",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          backgroundText: "ooh ooh",
          backgroundTextSource: "manual",
          detached: true,
        },
      ],
      [seedGroup("g1")],
    );

    useProjectStore.getState().removeLineBackground("a0");

    expect(bgVoice(getLine("a0"))).toBeNull();
    expect(bgVoice(getLine("a1"))).not.toBeNull();
  });
});

describe("project store · removeLineBackground · no-op paths", () => {
  it("returns the same lines reference and adds no history when the line has no bg", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", words: [{ text: "Real line", begin: 0, end: 2 }] }]);
    const linesBefore = useProjectStore.getState().lines;
    const canUndoBefore = useProjectStore.getState().canUndo();

    useProjectStore.getState().removeLineBackground("L1");

    expect(useProjectStore.getState().lines).toBe(linesBefore);
    expect(useProjectStore.getState().canUndo()).toBe(canUndoBefore);
  });

  it("is a no-op for a missing id", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", backgroundText: "ooh" }]);
    const linesBefore = useProjectStore.getState().lines;

    useProjectStore.getState().removeLineBackground("nope");

    expect(useProjectStore.getState().lines).toBe(linesBefore);
    expect(bgVoice(getLine("L1"))).not.toBeNull();
  });
});

describe("project store · removeLineBackground · invariants", () => {
  it("does not mutate the pre-removal line object", () => {
    seed([
      {
        id: "L1",
        text: "Real line",
        agentId: "v1",
        words: [{ text: "Real line", begin: 0, end: 2 }],
        backgroundText: "ooh",
      },
    ]);
    const before = getLine("L1");
    const backgroundSnapshot = before.background;

    useProjectStore.getState().removeLineBackground("L1");

    expect(before.background).toBe(backgroundSnapshot);
    expect(bgVoice(before)).not.toBeNull();
  });

  it("keeps unrelated lines reference-equal", () => {
    seed([
      { id: "L1", text: "Real line", agentId: "v1", backgroundText: "ooh" },
      { id: "L2", text: "Other line", agentId: "v1", backgroundText: "aah" },
    ]);
    const l2Before = getLine("L2");

    useProjectStore.getState().removeLineBackground("L1");

    expect(getLine("L2")).toBe(l2Before);
  });
});
