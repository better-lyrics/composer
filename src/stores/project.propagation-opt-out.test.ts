/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { addGroup } from "@/domain/commands/group-edits";
import { pasteLines } from "@/domain/commands/instance-rows";
import { lineEditCommand } from "@/domain/commands/line-edits";
import { retimeSyncWord, shiftSyncLine } from "@/domain/commands/sync";
import type { LinkGroup } from "insync/group";
import { lineFromFields } from "@/domain/line/line-from-fields";
import { mainTrack, timedSyllables } from "insync/line-track";
import { commitGesture } from "@/domain/sync/commit-gesture";
import type { WordTiming } from "insync/word-timing";
import { useProjectStore } from "@/stores/project";
import { fieldUpdates } from "@/test/field-updates";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// Regression coverage for issue #96: resyncing one instance of a group must not retime the other instances. Timing
// edits never change a group line's content, so they never reach other instances through the template.

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedGroup(id: string): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1 };
}

const INSTANCE_A_WORDS: WordTiming[] = [
  { id: "w1", text: "I", sep: " ", begin: 0, end: 0.4, joinsNext: false },
  { id: "w2", text: "love", sep: " ", begin: 0.4, end: 0.8, joinsNext: false },
  { id: "w3", text: "you", sep: "", begin: 0.8, end: 1.2, joinsNext: false },
];

const INSTANCE_B_WORDS: WordTiming[] = [
  { id: "w4", text: "I", sep: " ", begin: 10, end: 10.5, joinsNext: false },
  { id: "w5", text: "love", sep: " ", begin: 10.5, end: 11.0, joinsNext: false },
  { id: "w6", text: "you", sep: "", begin: 11.0, end: 11.5, joinsNext: false },
];

// Seeds in a single setState and marks the store dirty-since-history so the
// first *WithHistory mutation snapshots this state as the undo baseline.
function seedTwoWordSyncedInstances() {
  useProjectStore.setState({
    groups: [seedGroup("g1")],
    lines: [
      lineFromFields(
        {
          id: "a0",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: INSTANCE_A_WORDS.map((w) => ({ ...w })),
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
      lineFromFields(
        {
          id: "a1",
          text: "I love you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: INSTANCE_B_WORDS.map((w) => ({ ...w })),
        },
        DEFAULT_SPLIT_CHARACTER,
      ),
    ],
    isDirtySinceHistory: true,
  });
}

const MERGED_WORDS: WordTiming[] = [
  { id: "w7", text: "I", sep: " ", begin: 0, end: 0.4, joinsNext: false },
  { id: "w8", text: "love you", sep: "", begin: 0.4, end: 1.2, joinsNext: false },
];

function getLine(id: string) {
  const line = useProjectStore.getState().lines.find((l) => l.id === id);
  if (!line) throw new Error(`line ${id} not found`);
  return line;
}

describe("line edits on one instance", () => {
  it("still writes the source line", () => {
    seedTwoWordSyncedInstances();
    const sourceWords: WordTiming[] = [{ id: "w18", text: "I", sep: " ", begin: 9, end: 9.5, joinsNext: false }];

    useProjectStore
      .getState()
      .commit(
        lineEditCommand({ command: "edit lines", args: [] }, () =>
          fieldUpdates([{ id: "a0", updates: { words: sourceWords } }]),
        ),
      );

    expect(timedSyllables(mainTrack(getLine("a0")))).toEqual(sourceWords);
  });

  it("a structural word change reaches the other instances", () => {
    seedTwoWordSyncedInstances();

    useProjectStore.getState().commit(pasteLines(fieldUpdates([{ id: "a0", updates: { words: MERGED_WORDS } }])));

    expect(timedSyllables(mainTrack(getLine("a1")))).toHaveLength(2);
  });

  it("works for a non-grouped line (regression)", () => {
    useProjectStore.setState({
      lines: [lineFromFields({ id: "s", text: "standalone", agentId: "v1" }, DEFAULT_SPLIT_CHARACTER)],
    });

    useProjectStore.getState().commit(
      lineEditCommand({ command: "edit lines", args: [] }, () =>
        fieldUpdates([
          {
            id: "s",
            updates: { words: [{ id: "w19", text: "standalone", sep: "", begin: 1, end: 2, joinsNext: false }] },
          },
        ]),
      ),
    );

    expect(timedSyllables(mainTrack(getLine("s")))).toEqual([
      { text: "standalone", sep: "", begin: 1, end: 2, joinsNext: false },
    ]);
  });

  it("commits a single history entry that undo reverts", () => {
    seedTwoWordSyncedInstances();

    useProjectStore.getState().commit(
      lineEditCommand({ command: "edit lines", args: [] }, () =>
        fieldUpdates([
          {
            id: "a0",
            updates: { words: [{ id: "w20", text: "I", sep: " ", begin: 5, end: 5.4, joinsNext: false }] },
          },
        ]),
      ),
    );
    useProjectStore.getState().undo();

    expect(timedSyllables(mainTrack(getLine("a0")))).toEqual(INSTANCE_A_WORDS);
    expect(timedSyllables(mainTrack(getLine("a1")))).toEqual(INSTANCE_B_WORDS);
  });
});

describe("batched line edits on one instance", () => {
  it("a structural word change in a batch reaches the other instances", () => {
    seedTwoWordSyncedInstances();

    useProjectStore.getState().commit(pasteLines(fieldUpdates([{ id: "a0", updates: { words: MERGED_WORDS } }])));

    expect(timedSyllables(mainTrack(getLine("a1")))).toHaveLength(2);
  });
});

describe("instance resync · issue #96 reproduction", () => {
  // Replays useSyncHandlers.handleTap through the real commitGesture owner.
  function tapResync(lineId: string, wordIndex: number, begin: number) {
    const lines = useProjectStore.getState().lines;
    const lineIndex = lines.findIndex((l) => l.id === lineId);
    const commit = commitGesture(lines, "tap-word", {
      cursor: { lineIndex, wordIndex },
      jumped: false,
      time: begin,
      defaultWordDuration: 0.3,
      splitChar: DEFAULT_SPLIT_CHARACTER,
    });
    if (!commit) throw new Error("expected a commit");
    useProjectStore.getState().commit(lineEditCommand({ command: "edit lines", args: [] }, () => commit.lineUpdates));
  }

  it("resyncing instance A word-by-word leaves instance B's timing untouched", () => {
    seedTwoWordSyncedInstances();

    tapResync("a0", 0, 0.5);
    tapResync("a0", 1, 1.0);
    tapResync("a0", 2, 1.5);

    expect(timedSyllables(mainTrack(getLine("a1")))).toEqual(INSTANCE_B_WORDS);
  });

  it("the resynced instance A keeps its full word set with the new timing", () => {
    seedTwoWordSyncedInstances();

    tapResync("a0", 0, 0.5);
    tapResync("a0", 1, 1.0);
    tapResync("a0", 2, 1.5);

    expect(timedSyllables(mainTrack(getLine("a0")))).toEqual([
      { text: "I", sep: " ", begin: 0.5, end: 1.0, joinsNext: false },
      { text: "love", sep: " ", begin: 1.0, end: 1.5, joinsNext: false },
      { text: "you", sep: "", begin: 1.5, end: 1.8, joinsNext: false },
    ]);
  });

  it("resyncing does not squash a third instance either", () => {
    useProjectStore.getState().commit(addGroup(seedGroup("g1")));
    const cWords: WordTiming[] = [
      { id: "w22", text: "I", sep: " ", begin: 30, end: 30.6, joinsNext: false },
      { id: "w23", text: "love", sep: " ", begin: 30.6, end: 31.2, joinsNext: false },
      { id: "w24", text: "you", sep: "", begin: 31.2, end: 31.8, joinsNext: false },
    ];
    useProjectStore.setState({
      lines: [
        lineFromFields(
          {
            id: "a0",
            text: "I love you",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 0,
            templateLineIdx: 0,
            words: INSTANCE_A_WORDS.map((w) => ({ ...w })),
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
        lineFromFields(
          {
            id: "a1",
            text: "I love you",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 1,
            templateLineIdx: 0,
            words: INSTANCE_B_WORDS.map((w) => ({ ...w })),
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
        lineFromFields(
          {
            id: "a2",
            text: "I love you",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 2,
            templateLineIdx: 0,
            words: cWords.map((w) => ({ ...w })),
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
    });

    tapResync("a0", 0, 0.5);
    tapResync("a0", 1, 1.0);
    tapResync("a0", 2, 1.5);

    expect(timedSyllables(mainTrack(getLine("a1")))).toEqual(INSTANCE_B_WORDS);
    expect(timedSyllables(mainTrack(getLine("a2")))).toEqual(cWords);
  });

  it("a partial re-tap keeps the source's later words and leaves the sibling intact", () => {
    seedTwoWordSyncedInstances();

    tapResync("a0", 0, 0.5);

    expect(timedSyllables(mainTrack(getLine("a0")))).toHaveLength(3);
    expect(timedSyllables(mainTrack(getLine("a0")))[0].begin).toBe(0.5);
    expect(timedSyllables(mainTrack(getLine("a1")))).toEqual(INSTANCE_B_WORDS);
    expect(timedSyllables(mainTrack(getLine("a1")))).toHaveLength(3);
  });

  it("preserve-in-place keeps the word count stable, so a propagating re-tap no longer squashes the sibling", () => {
    seedTwoWordSyncedInstances();

    // Regression guard for issue #96.
    const lines = useProjectStore.getState().lines;
    const commit = commitGesture(lines, "tap-word", {
      cursor: { lineIndex: 0, wordIndex: 0 },
      jumped: false,
      time: 0.5,
      defaultWordDuration: 0.3,
      splitChar: DEFAULT_SPLIT_CHARACTER,
    });
    if (!commit) throw new Error("expected a commit");
    useProjectStore.getState().commit(lineEditCommand({ command: "edit lines", args: [] }, () => commit.lineUpdates));

    expect(timedSyllables(mainTrack(getLine("a1")))).toHaveLength(3);
    expect(timedSyllables(mainTrack(getLine("a1")))).toEqual(INSTANCE_B_WORDS);
  });
});

describe("line edits on one instance · edge cases", () => {
  it("leaves a detached sibling untouched", () => {
    seedTwoWordSyncedInstances();
    useProjectStore.setState((s) => ({
      lines: s.lines.map((l) => (l.id === "a1" ? { ...l, detached: true } : l)),
    }));

    useProjectStore.getState().commit(
      lineEditCommand({ command: "edit lines", args: [] }, () =>
        fieldUpdates([
          {
            id: "a0",
            updates: { words: [{ id: "w25", text: "I", sep: " ", begin: 5, end: 5.4, joinsNext: false }] },
          },
        ]),
      ),
    );

    expect(timedSyllables(mainTrack(getLine("a1")))).toEqual(INSTANCE_B_WORDS);
  });

  it("does not throw and changes nothing for an unknown line id", () => {
    seedTwoWordSyncedInstances();

    expect(() =>
      useProjectStore.getState().commit(
        lineEditCommand({ command: "edit lines", args: [] }, () => [
          {
            id: "nope",
            updates: {
              tracks: lineFromFields({ id: "nope", text: "", agentId: "v1", words: [] }, DEFAULT_SPLIT_CHARACTER)
                .tracks,
            },
          },
        ]),
      ),
    ).not.toThrow();
    expect(timedSyllables(mainTrack(getLine("a0")))).toEqual(INSTANCE_A_WORDS);
    expect(timedSyllables(mainTrack(getLine("a1")))).toEqual(INSTANCE_B_WORDS);
  });

  it("handles a single-instance group with no siblings", () => {
    useProjectStore.getState().commit(addGroup(seedGroup("g1")));
    useProjectStore.setState({
      lines: [
        lineFromFields(
          {
            id: "solo",
            text: "I love you",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 0,
            templateLineIdx: 0,
            words: INSTANCE_A_WORDS.map((w) => ({ ...w })),
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
    });

    expect(() =>
      useProjectStore.getState().commit(
        lineEditCommand({ command: "edit lines", args: [] }, () =>
          fieldUpdates([
            {
              id: "solo",
              updates: { words: [{ id: "w26", text: "I", sep: " ", begin: 5, end: 5.4, joinsNext: false }] },
            },
          ]),
        ),
      ),
    ).not.toThrow();
    expect(timedSyllables(mainTrack(getLine("solo")))).toEqual([
      { text: "I", sep: " ", begin: 5, end: 5.4, joinsNext: false },
    ]);
  });

  it("does not touch lines belonging to a different group", () => {
    seedTwoWordSyncedInstances();
    const otherWords: WordTiming[] = [{ id: "w27", text: "other", sep: "", begin: 50, end: 51, joinsNext: false }];
    useProjectStore.setState((s) => ({
      lines: [
        ...s.lines,
        lineFromFields(
          {
            id: "x",
            text: "other",
            agentId: "v1",
            groupId: "g2",
            instanceIdx: 0,
            templateLineIdx: 0,
            words: otherWords.map((w) => ({ ...w })),
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
    }));

    useProjectStore.getState().commit(
      lineEditCommand({ command: "edit lines", args: [] }, () =>
        fieldUpdates([
          {
            id: "a0",
            updates: { words: [{ id: "w28", text: "I", sep: " ", begin: 5, end: 5.4, joinsNext: false }] },
          },
        ]),
      ),
    );

    expect(timedSyllables(mainTrack(getLine("x")))).toEqual(otherWords);
  });
});

describe("timing nudges · do not propagate to siblings", () => {
  it("nudgeWordBegin on one instance leaves the sibling's words untouched", () => {
    seedTwoWordSyncedInstances();

    useProjectStore
      .getState()
      .commit(
        retimeSyncWord(
          { lineId: useProjectStore.getState().lines[0].id, track: "word", wordIndex: 1 },
          "begin",
          { by: 0.1 },
          Number.POSITIVE_INFINITY,
        ),
      );

    expect(timedSyllables(mainTrack(getLine("a1")))).toEqual(INSTANCE_B_WORDS);
  });

  it("setWordBegin does not overwrite a sibling word whose text has diverged", () => {
    // A nudge is a pure timing edit. Before the opt-out it ran propagation,
    // and propagation's fast path would copy the source word texts onto a
    // text-diverged sibling. A timing edit must never rewrite sibling text.
    useProjectStore.setState({
      groups: [seedGroup("g1")],
      lines: [
        lineFromFields(
          {
            id: "a0",
            text: "I love you",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 0,
            templateLineIdx: 0,
            words: INSTANCE_A_WORDS.map((w) => ({ ...w })),
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
        lineFromFields(
          {
            id: "a1",
            text: "I love you",
            agentId: "v1",
            groupId: "g1",
            instanceIdx: 1,
            templateLineIdx: 0,
            words: [
              { id: "w34", text: "I", sep: " ", begin: 10, end: 10.5, joinsNext: false },
              { id: "w35", text: "LOVE", sep: " ", begin: 10.5, end: 11.0, joinsNext: false },
              { id: "w36", text: "you", sep: "", begin: 11.0, end: 11.5, joinsNext: false },
            ],
          },
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
      isDirtySinceHistory: true,
    });

    useProjectStore
      .getState()
      .commit(
        retimeSyncWord(
          { lineId: useProjectStore.getState().lines[0].id, track: "word", wordIndex: 0 },
          "begin",
          { to: 0.2 },
          Number.POSITIVE_INFINITY,
        ),
      );

    expect(timedSyllables(mainTrack(getLine("a1")))[1]).toMatchObject({ text: "LOVE", sep: " " });
  });

  it("nudgeLineBegin on one line-synced instance leaves the sibling's bounds untouched", () => {
    useProjectStore.setState({
      groups: [seedGroup("g1")],
      lines: [
        lineFromFields(
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
          DEFAULT_SPLIT_CHARACTER,
        ),
        lineFromFields(
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
          DEFAULT_SPLIT_CHARACTER,
        ),
      ],
      isDirtySinceHistory: true,
    });

    useProjectStore
      .getState()
      .commit(shiftSyncLine(useProjectStore.getState().lines[0].id, { by: 0.5 }, Number.POSITIVE_INFINITY));

    expect(mainTrack(getLine("a1")).begin).toBe(60);
    expect(mainTrack(getLine("a1")).end).toBe(62);
  });
});
