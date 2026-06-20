/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import { bgBounds, mainBounds } from "@/domain/line/bounds";
import { type LooseLine, reconcileLine } from "@/domain/line/model";
import { applyBackground } from "@/domain/line/background";
import { placeVoice } from "@/domain/line/place-voice";
import { bgText, bgVoice, bgWords, lineText, mainWords } from "@/domain/line/voices";
import { isLineSynced, isWordSynced } from "@/domain/voice/predicates";
import { useProjectStore } from "@/stores/project";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";
import { beforeEach, describe, expect, it } from "vitest";

// Store half of the #122 fix: a nested-aware background write path that persists
// a resolver-resolved (possibly line-synced) background. The flat update API
// cannot carry a line-synced background, so an untimed bg text over a
// line-synced main used to be word-split. These tests exercise the real store
// actions with real data, no mocks.

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedGroup(id: string): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1 };
}

// Seeds lines in a single setState and marks the store dirty-since-history so
// the first *WithHistory mutation snapshots this state as the undo baseline.
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

describe("project store · applyLineBackground", () => {
  it("regression: line-synced line keeps line-synced background (#122)", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);

    useProjectStore.getState().applyLineBackground("L1", { text: "ooh", source: "manual" });

    const stored = getLine("L1");
    expect(bgBounds(stored)).toEqual({ begin: 4, end: 6 });
    expect(bgWords(stored)).toBeUndefined();
    const bg = bgVoice(stored);
    expect(bg).not.toBeNull();
    if (bg) expect(isLineSynced(bg)).toBe(true);
  });

  it("distributes bg to word-synced over a word-synced main", () => {
    seed([
      {
        id: "L1",
        text: "Real line",
        agentId: "v1",
        words: [
          { text: "Real ", begin: 0, end: 1 },
          { text: "line", begin: 1, end: 2 },
        ],
      },
    ]);

    useProjectStore.getState().applyLineBackground("L1", { text: "ooh", source: "manual" });

    const stored = getLine("L1");
    const words = bgWords(stored);
    expect(words).toBeDefined();
    const bg = bgVoice(stored);
    expect(bg).not.toBeNull();
    if (bg) expect(isWordSynced(bg)).toBe(true);
  });

  it("keeps bg untimed over an untimed main", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1" }]);

    useProjectStore.getState().applyLineBackground("L1", { text: "ooh", source: "manual" });

    const stored = getLine("L1");
    expect(bgWords(stored)).toBeUndefined();
    expect(bgBounds(stored)).toBeNull();
    const bg = bgVoice(stored);
    expect(bg).not.toBeNull();
  });

  it("keeps a word-synced params verbatim regardless of main granularity", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);

    const words = [
      { text: "ooh ", begin: 3, end: 4 },
      { text: "aah", begin: 4, end: 5 },
    ];
    useProjectStore.getState().applyLineBackground("L1", { words, source: "extraction" });

    const stored = getLine("L1");
    expect(bgWords(stored)).toEqual(words);
    const bg = bgVoice(stored);
    if (bg) expect(isWordSynced(bg)).toBe(true);
  });

  it("no-ops when the target line is absent", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);
    const before = useProjectStore.getState().lines;

    useProjectStore.getState().applyLineBackground("missing", { text: "ooh", source: "manual" });

    expect(useProjectStore.getState().lines).toBe(before);
  });
});

describe("project store · applyLineBackground · clearing", () => {
  it("removes a line-synced background entirely on empty text", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);
    useProjectStore.getState().applyLineBackground("L1", { text: "ooh", source: "manual" });
    expect(bgVoice(getLine("L1"))).not.toBeNull();

    useProjectStore.getState().applyLineBackground("L1", { text: "", source: "manual" });

    expect(bgVoice(getLine("L1"))).toBeNull();
  });

  it("removes a word-synced background entirely on empty text", () => {
    seed([
      {
        id: "L1",
        text: "Real line",
        agentId: "v1",
        words: [{ text: "Real line", begin: 0, end: 2 }],
        backgroundText: "ooh",
        backgroundWords: [{ text: "ooh", begin: 1, end: 2 }],
        backgroundTextSource: "extraction",
      },
    ]);
    expect(bgVoice(getLine("L1"))).not.toBeNull();

    useProjectStore.getState().applyLineBackground("L1", { text: "", source: "manual" });

    expect(bgVoice(getLine("L1"))).toBeNull();
  });
});

describe("project store · applyLineBackground · history", () => {
  it("undo restores the prior line and redo re-applies", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);

    useProjectStore.getState().applyLineBackground("L1", { text: "ooh", source: "manual" });
    expect(bgVoice(getLine("L1"))).not.toBeNull();
    expect(useProjectStore.getState().canUndo()).toBe(true);

    useProjectStore.getState().undo();
    expect(bgVoice(getLine("L1"))).toBeNull();

    useProjectStore.getState().redo();
    const restored = getLine("L1");
    expect(bgBounds(restored)).toEqual({ begin: 4, end: 6 });
    const bg = bgVoice(restored);
    if (bg) expect(isLineSynced(bg)).toBe(true);
  });
});

describe("project store · applyLineBackground · sibling propagation", () => {
  it("re-resolves each linked sibling's bg over its own bounds", () => {
    seed(
      [
        {
          id: "a0",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 0,
          end: 4,
        },
        {
          id: "a1",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          begin: 10,
          end: 20,
        },
      ],
      [seedGroup("g1")],
    );

    useProjectStore.getState().applyLineBackground("a0", { text: "ooh", source: "manual" });

    const a0 = getLine("a0");
    const a1 = getLine("a1");
    expect(bgBounds(a0)).toEqual({ begin: 2, end: 4 });
    expect(bgBounds(a1)).toEqual({ begin: 15, end: 20 });
    const bg0 = bgVoice(a0);
    const bg1 = bgVoice(a1);
    expect(bg0).not.toBeNull();
    expect(bg1).not.toBeNull();
    expect(isLineSynced(bg0 as NonNullable<typeof bg0>)).toBe(true);
    expect(isLineSynced(bg1 as NonNullable<typeof bg1>)).toBe(true);
  });

  it("re-resolves per sibling main granularity, not by copying timing", () => {
    seed(
      [
        {
          id: "a0",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 0,
          end: 4,
        },
        {
          id: "a1",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { text: "Real ", begin: 10, end: 11 },
            { text: "line", begin: 11, end: 12 },
          ],
        },
      ],
      [seedGroup("g1")],
    );

    useProjectStore.getState().applyLineBackground("a0", { text: "ooh", source: "manual" });

    const bg0 = bgVoice(getLine("a0"));
    const bg1 = bgVoice(getLine("a1"));
    expect(bg0).not.toBeNull();
    expect(bg1).not.toBeNull();
    expect(isLineSynced(bg0 as NonNullable<typeof bg0>)).toBe(true);
    expect(isWordSynced(bg1 as NonNullable<typeof bg1>)).toBe(true);
  });

  it("leaves a detached sibling untouched", () => {
    seed(
      [
        {
          id: "a0",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 0,
          end: 4,
        },
        {
          id: "a1",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          begin: 10,
          end: 20,
          detached: true,
        },
      ],
      [seedGroup("g1")],
    );

    useProjectStore.getState().applyLineBackground("a0", { text: "ooh", source: "manual" });

    expect(bgVoice(getLine("a0"))).not.toBeNull();
    expect(bgVoice(getLine("a1"))).toBeNull();
  });

  it("propagateToSiblings: false leaves the sibling untouched", () => {
    seed(
      [
        {
          id: "a0",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 0,
          end: 4,
        },
        {
          id: "a1",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          begin: 10,
          end: 20,
        },
      ],
      [seedGroup("g1")],
    );
    const a1Before = getLine("a1");

    useProjectStore
      .getState()
      .applyLineBackground("a0", { text: "ooh", source: "manual" }, { propagateToSiblings: false });

    expect(bgVoice(getLine("a0"))).not.toBeNull();
    expect(getLine("a1")).toBe(a1Before);
    expect(bgVoice(getLine("a1"))).toBeNull();
  });
});

describe("project store · setLineWithHistory", () => {
  it("persists a line-synced background carried on the replacement line", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);

    const target = getLine("L1");
    const replacement = applyBackground(target, { text: "ooh", source: "manual" });
    expect(bgBounds(replacement)).toEqual({ begin: 4, end: 6 });

    useProjectStore.getState().setLineWithHistory("L1", replacement);

    const stored = getLine("L1");
    expect(bgBounds(stored)).toEqual({ begin: 4, end: 6 });
    expect(bgWords(stored)).toBeUndefined();
    const bg = bgVoice(stored);
    if (bg) expect(isLineSynced(bg)).toBe(true);
  });

  it("drops the background when the replacement line has none", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);
    useProjectStore.getState().applyLineBackground("L1", { text: "ooh", source: "manual" });
    expect(bgVoice(getLine("L1"))).not.toBeNull();

    const cleared = reconcileLine({ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 });
    useProjectStore.getState().setLineWithHistory("L1", cleared);

    expect(bgVoice(getLine("L1"))).toBeNull();
  });

  it("propagates a main-word structural change to a linked word-synced sibling, keeping its own timing", () => {
    seed(
      [
        {
          id: "a0",
          text: "Hi (ooh) there",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { text: "Hi ", begin: 0, end: 1 },
            { text: "(ooh) ", begin: 1, end: 2 },
            { text: "there", begin: 2, end: 3 },
          ],
        },
        {
          id: "a1",
          text: "Hi (ooh) there",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { text: "Hi ", begin: 10, end: 11 },
            { text: "(ooh) ", begin: 11, end: 12 },
            { text: "there", begin: 12, end: 13 },
          ],
        },
      ],
      [seedGroup("g1")],
    );

    const extracted = reconcileLine({
      id: "a0",
      text: "Hi there",
      agentId: "v1",
      groupId: "g1",
      instanceIdx: 0,
      templateLineIdx: 0,
      words: [
        { text: "Hi ", begin: 0, end: 1 },
        { text: "there", begin: 2, end: 3 },
      ],
    });
    useProjectStore.getState().setLineWithHistory("a0", extracted);

    const sibling = getLine("a1");
    expect(mainWords(sibling)).toEqual([
      { text: "Hi ", begin: 10, end: 11 },
      { text: "there", begin: 12, end: 13 },
    ]);
    expect(lineText(sibling)).toBe("Hi there");
  });

  it("is a no-op for a missing target and commits no history entry", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);
    const linesBefore = useProjectStore.getState().lines;
    const canUndoBefore = useProjectStore.getState().canUndo();

    const replacement = reconcileLine({ id: "ghost", text: "ghost", agentId: "v1" });
    useProjectStore.getState().setLineWithHistory("ghost", replacement);

    expect(useProjectStore.getState().lines).toBe(linesBefore);
    expect(useProjectStore.getState().canUndo()).toBe(canUndoBefore);
  });
});

describe("project store · main-to-word transition follows background", () => {
  it("transition: line-synced main + line-synced bg becomes word-synced bg over its own bounds", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 }]);
    useProjectStore.getState().applyLineBackground("L1", { text: "ooh ahh", source: "manual" });

    const before = getLine("L1");
    expect(bgBounds(before)).toEqual({ begin: 6, end: 10 });
    expect(bgWords(before)).toBeUndefined();

    useProjectStore.getState().updateLineWithHistory(
      "L1",
      {
        words: [
          { text: "Real ", begin: 2, end: 5 },
          { text: "line", begin: 5, end: 10 },
        ],
      },
      { deriveText: false },
    );

    const after = getLine("L1");
    expect(isWordSynced(after.main)).toBe(true);
    const words = bgWords(after);
    expect(words).toBeDefined();
    if (!words) throw new Error("expected bg words");
    expect(words.length).toBe(2);
    expect(words[0].begin).toBe(6);
    expect(words[words.length - 1].end).toBe(10);
  });

  it("leaves a word-synced background's words unchanged when main becomes word-synced", () => {
    const bgWordsInput = [
      { text: "ooh ", begin: 3, end: 4 },
      { text: "ahh", begin: 4, end: 5 },
    ];
    seed([
      {
        id: "L1",
        text: "Real line",
        agentId: "v1",
        begin: 2,
        end: 10,
        backgroundText: "ooh ahh",
        backgroundWords: bgWordsInput,
        backgroundTextSource: "extraction",
      },
    ]);
    const bgBefore = bgVoice(getLine("L1"));

    useProjectStore.getState().updateLineWithHistory(
      "L1",
      {
        words: [
          { text: "Real ", begin: 2, end: 5 },
          { text: "line", begin: 5, end: 10 },
        ],
      },
      { deriveText: false },
    );

    const after = getLine("L1");
    expect(isWordSynced(after.main)).toBe(true);
    expect(bgVoice(after)).toEqual(bgBefore);
    expect(bgWords(after)).toEqual(bgWordsInput);
  });

  it("transition: untimed bg distributes over the new main's second half", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1" }]);
    useProjectStore.getState().applyLineBackground("L1", { text: "ooh ahh", source: "manual" });

    const before = getLine("L1");
    expect(bgWords(before)).toBeUndefined();
    expect(bgBounds(before)).toBeNull();

    useProjectStore.getState().updateLineWithHistory(
      "L1",
      {
        words: [
          { text: "Real ", begin: 4, end: 8 },
          { text: "line", begin: 8, end: 12 },
        ],
      },
      { deriveText: false },
    );

    const after = getLine("L1");
    expect(isWordSynced(after.main)).toBe(true);
    const words = bgWords(after);
    expect(words).toBeDefined();
    if (!words) throw new Error("expected bg words");
    expect(words[0].begin).toBe(8);
    expect(words[words.length - 1].end).toBe(12);
  });

  it("does not re-resolve a bg when main was ALREADY word-synced before the write", () => {
    const bgWordsInput = [
      { text: "ooh ", begin: 0, end: 1 },
      { text: "ahh", begin: 1, end: 2 },
    ];
    seed([
      {
        id: "L1",
        text: "Real line",
        agentId: "v1",
        words: [
          { text: "Real ", begin: 0, end: 1 },
          { text: "line", begin: 1, end: 2 },
        ],
        backgroundText: "ooh ahh",
        backgroundWords: bgWordsInput,
        backgroundTextSource: "manual",
      },
    ]);

    useProjectStore.getState().updateLineWithHistory(
      "L1",
      {
        words: [
          { text: "Real ", begin: 0, end: 5 },
          { text: "line", begin: 5, end: 10 },
        ],
      },
      { deriveText: false },
    );

    const after = bgWords(getLine("L1"));
    expect(after).toEqual(bgWordsInput);
  });

  it("is a no-op for the background when the line has none", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 }]);

    useProjectStore.getState().updateLineWithHistory(
      "L1",
      {
        words: [
          { text: "Real ", begin: 2, end: 5 },
          { text: "line", begin: 5, end: 10 },
        ],
      },
      { deriveText: false },
    );

    const after = getLine("L1");
    expect(isWordSynced(after.main)).toBe(true);
    expect(bgVoice(after)).toBeNull();
    expect("background" in after).toBe(false);
  });

  it("updateLine (no-history) also follows the background into word-synced", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 }]);
    useProjectStore.getState().applyLineBackground("L1", { text: "ooh ahh", source: "manual" });

    useProjectStore.getState().updateLine(
      "L1",
      {
        words: [
          { text: "Real ", begin: 2, end: 5 },
          { text: "line", begin: 5, end: 10 },
        ],
      },
      { deriveText: false },
    );

    const after = getLine("L1");
    expect(isWordSynced(after.main)).toBe(true);
    const words = bgWords(after);
    expect(words).toBeDefined();
    if (!words) throw new Error("expected bg words");
    expect(words[0].begin).toBe(6);
    expect(words[words.length - 1].end).toBe(10);
  });

  // No generic-mutator path propagates a FRESH `words` array to a line-synced
  // sibling: propagateWordChanges returns undefined when the sibling has no
  // main words (`!siblingWords`), so a line-synced sibling never transitions to
  // word-synced via propagation. The propagated-transition scenario is therefore
  // unreachable in practice. updateLinesWithHistory does treat each entry as its
  // own target, so a batch that transitions two linked line-synced lines follows
  // each of their backgrounds (each via the target reconcile, not propagation).
  it("updateLinesWithHistory transitions and follows the background of every targeted line", () => {
    seed(
      [
        {
          id: "a0",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          begin: 0,
          end: 4,
        },
        {
          id: "a1",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          begin: 10,
          end: 20,
        },
      ],
      [seedGroup("g1")],
    );
    useProjectStore.getState().applyLineBackground("a0", { text: "ooh ahh", source: "manual" });
    useProjectStore.getState().applyLineBackground("a1", { text: "ooh ahh", source: "manual" });

    const a0BgBefore = bgBounds(getLine("a0"));
    const a1BgBefore = bgBounds(getLine("a1"));
    if (!a0BgBefore || !a1BgBefore) throw new Error("expected line-synced backgrounds");

    useProjectStore.getState().updateLinesWithHistory(
      [
        {
          id: "a0",
          updates: {
            words: [
              { text: "Real ", begin: 0, end: 2 },
              { text: "line", begin: 2, end: 4 },
            ],
          },
        },
        {
          id: "a1",
          updates: {
            words: [
              { text: "Real ", begin: 10, end: 15 },
              { text: "line", begin: 15, end: 20 },
            ],
          },
        },
      ],
      { propagateToSiblings: false },
    );

    const a0 = getLine("a0");
    const a1 = getLine("a1");
    expect(isWordSynced(a0.main)).toBe(true);
    expect(isWordSynced(a1.main)).toBe(true);
    const a0Bg = bgWords(a0);
    const a1Bg = bgWords(a1);
    expect(a0Bg).toBeDefined();
    expect(a1Bg).toBeDefined();
    if (!a0Bg || !a1Bg) throw new Error("expected bg words on both");
    expect(a0Bg[0].begin).toBe(a0BgBefore.begin);
    expect(a0Bg[a0Bg.length - 1].end).toBe(a0BgBefore.end);
    expect(a1Bg[0].begin).toBe(a1BgBefore.begin);
    expect(a1Bg[a1Bg.length - 1].end).toBe(a1BgBefore.end);
  });

  it("leaves a linked word-synced sibling's word-synced bg untouched on a propagated rename", () => {
    seed(
      [
        {
          id: "a0",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { text: "Real ", begin: 0, end: 1 },
            { text: "line", begin: 1, end: 2 },
          ],
          backgroundText: "ooh ahh",
          backgroundWords: [
            { text: "ooh ", begin: 0, end: 1 },
            { text: "ahh", begin: 1, end: 2 },
          ],
          backgroundTextSource: "manual",
        },
        {
          id: "a1",
          text: "Real line",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { text: "Real ", begin: 10, end: 11 },
            { text: "line", begin: 11, end: 12 },
          ],
          backgroundText: "ooh ahh",
          backgroundWords: [
            { text: "ooh ", begin: 10, end: 11 },
            { text: "ahh", begin: 11, end: 12 },
          ],
          backgroundTextSource: "manual",
        },
      ],
      [seedGroup("g1")],
    );
    const a1BgBefore = bgWords(getLine("a1"));

    useProjectStore.getState().updateLineWithHistory("a0", {
      words: [
        { text: "Real ", begin: 0, end: 1 },
        { text: "song", begin: 1, end: 2 },
      ],
    });

    expect(bgWords(getLine("a1"))).toEqual(a1BgBefore);
  });

  it("undo restores the line-synced bg and redo restores the followed word-synced bg", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 }]);
    useProjectStore.getState().applyLineBackground("L1", { text: "ooh ahh", source: "manual" });
    useProjectStore.getState().clearHistory();
    useProjectStore.setState({ isDirtySinceHistory: true });

    useProjectStore.getState().updateLineWithHistory(
      "L1",
      {
        words: [
          { text: "Real ", begin: 2, end: 5 },
          { text: "line", begin: 5, end: 10 },
        ],
      },
      { deriveText: false },
    );
    const followed = bgWords(getLine("L1"));
    expect(followed).toBeDefined();

    useProjectStore.getState().undo();
    const undone = getLine("L1");
    expect(bgWords(undone)).toBeUndefined();
    expect(bgBounds(undone)).toEqual({ begin: 6, end: 10 });

    useProjectStore.getState().redo();
    expect(bgWords(getLine("L1"))).toEqual(followed);
  });

  it("distributes a line-synced bg over its OWN bounds, not the main fallback, on transition", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 }]);
    useProjectStore.setState((state) => ({
      lines: state.lines.map((l) =>
        l.id === "L1" ? { ...l, background: { text: "ooh ahh", begin: 3, end: 7, source: "manual" as const } } : l,
      ),
    }));
    expect(bgBounds(getLine("L1"))).toEqual({ begin: 3, end: 7 });

    useProjectStore.getState().updateLineWithHistory(
      "L1",
      {
        words: [
          { text: "Real ", begin: 2, end: 5 },
          { text: "line", begin: 5, end: 10 },
        ],
      },
      { deriveText: false },
    );

    const words = bgWords(getLine("L1"));
    expect(words).toBeDefined();
    if (!words) throw new Error("expected bg words");
    expect(words[0].begin).toBe(3);
    expect(words[words.length - 1].end).toBe(7);
  });

  it("keeps a line-synced background line-synced through a non-background update", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 }]);
    useProjectStore.getState().applyLineBackground("L1", { text: "ooh", source: "manual" });
    const bgBefore = bgBounds(getLine("L1"));
    expect(bgBefore).not.toBeNull();

    useProjectStore.getState().updateLineWithHistory("L1", { agentId: "v2" }, { deriveText: false });

    const after = getLine("L1");
    expect(after.agentId).toBe("v2");
    expect(bgBounds(after)).toEqual(bgBefore);
    expect(bgWords(after)).toBeUndefined();
    const bg = bgVoice(after);
    expect(bg).not.toBeNull();
    if (bg) expect(isLineSynced(bg)).toBe(true);
  });

  it("distributes a degenerate zero-duration line-synced bg into zero-width words", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 10 }]);
    useProjectStore.setState((state) => ({
      lines: state.lines.map((l) =>
        l.id === "L1" ? { ...l, background: { text: "ooh ahh", begin: 5, end: 5, source: "manual" as const } } : l,
      ),
    }));
    expect(bgBounds(getLine("L1"))).toEqual({ begin: 5, end: 5 });

    useProjectStore.getState().updateLineWithHistory(
      "L1",
      {
        words: [
          { text: "Real ", begin: 2, end: 5 },
          { text: "line", begin: 5, end: 10 },
        ],
      },
      { deriveText: false },
    );

    const words = bgWords(getLine("L1"));
    expect(words).toBeDefined();
    if (!words) throw new Error("expected bg words");
    expect(words.length).toBe(2);
    for (const word of words) {
      expect(word.begin).toBe(5);
      expect(word.end).toBe(5);
    }
  });
});

describe("project store · applyLineBackground · invariants", () => {
  it("does not mutate the input params", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);
    const params = { text: "ooh", source: "manual" as const };
    const snapshot = { ...params };

    useProjectStore.getState().applyLineBackground("L1", params);

    expect(params).toEqual(snapshot);
  });

  it("keeps unrelated lines reference-equal", () => {
    seed([
      { id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 },
      { id: "L2", text: "Other line", agentId: "v1", begin: 8, end: 12 },
    ]);
    const l2Before = getLine("L2");

    useProjectStore.getState().applyLineBackground("L1", { text: "ooh", source: "manual" });

    expect(getLine("L2")).toBe(l2Before);
  });

  it("does not mutate the input nextLine in setLineWithHistory", () => {
    seed([{ id: "L1", text: "Real line", agentId: "v1", begin: 2, end: 6 }]);
    const replacement = applyBackground(getLine("L1"), { text: "ooh", source: "manual" });
    const beforeBounds = bgBounds(replacement);

    useProjectStore.getState().setLineWithHistory("L1", replacement);

    expect(bgBounds(replacement)).toEqual(beforeBounds);
    expect(mainBounds(replacement)).toEqual({ begin: 2, end: 6 });
  });
});

// Regression lock for the Task 8.1 placeVoice funnel: placing one instance's
// MAIN voice ("place line here" in the timeline) is a pure per-instance timing
// write. It must NOT propagate to linked siblings, otherwise every sibling
// instance's background gets cleared or re-resolved. Both UI call sites place
// through setLineWithHistory with { propagateToSiblings: false }; these tests
// reproduce that exact production call convention with real store actions.
describe("project store · placeVoice main · leaves linked siblings untouched", () => {
  const PLACE_TIME = 5;
  const PLACE_DUR = 0.4;

  // Background text is consistent with its words (join of the word texts) so
  // commitHistory's derive-text pass is a no-op: the only thing that can mutate
  // the sibling here is sibling propagation, which is exactly what we lock out.
  function seedLinkedPair() {
    seed(
      [
        {
          id: "a0",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "ooh ooh",
          backgroundWords: [
            { text: "ooh ", begin: 0, end: 0.5 },
            { text: "ooh", begin: 0.5, end: 1 },
          ],
          backgroundTextSource: "manual",
        },
        {
          id: "a1",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          backgroundText: "ooh ooh",
          backgroundWords: [
            { text: "ooh ", begin: 20, end: 20.5 },
            { text: "ooh", begin: 20.5, end: 21 },
          ],
          backgroundTextSource: "manual",
        },
      ],
      [seedGroup("g1")],
    );
  }

  it("regression: placing one instance's main voice does not clobber a linked sibling's background", () => {
    seedLinkedPair();
    const siblingBgBefore = bgVoice(getLine("a1"));
    expect(siblingBgBefore).not.toBeNull();

    const target = getLine("a0");
    useProjectStore
      .getState()
      .setLineWithHistory("a0", placeVoice(target, "main", PLACE_TIME, PLACE_DUR), { propagateToSiblings: false });

    expect(bgVoice(getLine("a1"))).toEqual(siblingBgBefore);
    expect(bgWords(getLine("a1"))).toEqual([
      { text: "ooh ", begin: 20, end: 20.5 },
      { text: "ooh", begin: 20.5, end: 21 },
    ]);
  });

  it("places the target line-synced at [time, time + max(wordCount,1)*dur]", () => {
    seedLinkedPair();
    const target = getLine("a0");
    const wordCount = splitIntoWordsWithMeta(lineText(target)).parts.length;

    useProjectStore
      .getState()
      .setLineWithHistory("a0", placeVoice(target, "main", PLACE_TIME, PLACE_DUR), { propagateToSiblings: false });

    const placed = getLine("a0");
    expect(isLineSynced(placed.main)).toBe(true);
    expect(mainBounds(placed)).toEqual({
      begin: PLACE_TIME,
      end: PLACE_TIME + Math.max(wordCount, 1) * PLACE_DUR,
    });
  });

  it("leaves the sibling reference-equal (no rewrite at all)", () => {
    seedLinkedPair();
    const a1Before = getLine("a1");

    const target = getLine("a0");
    useProjectStore
      .getState()
      .setLineWithHistory("a0", placeVoice(target, "main", PLACE_TIME, PLACE_DUR), { propagateToSiblings: false });

    expect(getLine("a1")).toBe(a1Before);
  });
});

// Mirror of the main-place lock, for the "place background here" timeline item.
// Placing one instance's BACKGROUND voice is a per-instance timing write that
// must NOT propagate: a linked sibling that has its own untimed bg must keep it
// untimed. Both arms place through setLineWithHistory with
// { propagateToSiblings: false }, reproducing the production call convention.
describe("project store · placeVoice background · leaves linked siblings untouched", () => {
  const PLACE_TIME = 5;
  const PLACE_DUR = 0.4;

  // Two linked instances of the same line, each with an UNTIMED background
  // (text only, no words). The main is untimed too so both sit in the
  // placeable state the bg-track menu item gates on.
  function seedLinkedPair() {
    seed(
      [
        {
          id: "a0",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          backgroundText: "ooh ooh",
          backgroundTextSource: "manual",
        },
        {
          id: "a1",
          text: "I love you",
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

  it("regression: placing one instance's bg does not clobber a linked sibling's background", () => {
    seedLinkedPair();
    const siblingBgBefore = bgVoice(getLine("a1"));
    expect(siblingBgBefore).not.toBeNull();
    expect(bgBounds(getLine("a1"))).toBeNull();

    const target = getLine("a0");
    useProjectStore.getState().setLineWithHistory("a0", placeVoice(target, "background", PLACE_TIME, PLACE_DUR), {
      propagateToSiblings: false,
    });

    expect(bgVoice(getLine("a1"))).toEqual(siblingBgBefore);
    expect(bgBounds(getLine("a1"))).toBeNull();
    expect(bgWords(getLine("a1"))).toBeUndefined();
  });

  it("places the target's bg line-synced at [time, time + max(bgWordCount,1)*dur]", () => {
    seedLinkedPair();
    const target = getLine("a0");
    const text = bgText(target);
    if (text === undefined) throw new Error("expected bg text");
    const bgWordCount = splitIntoWordsWithMeta(text).parts.length;

    useProjectStore.getState().setLineWithHistory("a0", placeVoice(target, "background", PLACE_TIME, PLACE_DUR), {
      propagateToSiblings: false,
    });

    const placed = getLine("a0");
    expect(bgWords(placed)).toBeUndefined();
    expect(bgBounds(placed)).toEqual({
      begin: PLACE_TIME,
      end: PLACE_TIME + Math.max(bgWordCount, 1) * PLACE_DUR,
    });
    expect(mainBounds(placed)).toBeNull();
  });

  it("leaves the sibling reference-equal (no rewrite at all)", () => {
    seedLinkedPair();
    const a1Before = getLine("a1");

    const target = getLine("a0");
    useProjectStore.getState().setLineWithHistory("a0", placeVoice(target, "background", PLACE_TIME, PLACE_DUR), {
      propagateToSiblings: false,
    });

    expect(getLine("a1")).toBe(a1Before);
  });
});
