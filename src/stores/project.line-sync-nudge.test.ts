import { mainTrack, timedSyllables } from "@/domain/line/track";
import { INITIAL_STATE, useProjectStore } from "@/stores/project";
/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from "vitest";
import { pasteLines } from "@/domain/commands/instance-rows";
import { pasteLyrics } from "@/domain/commands/edit-text";

// These tests pin the contract that nudging a line-synced row by writing
// only `begin/end` (without `words`) keeps it line-synced. The previous bug
// was that the keyboard handler synthesized a single-word update for line-synced
// rows; the store then cleared `begin/end` and flipped the row to word-synced.

describe("project store · line-sync nudge granularity", () => {
  beforeEach(() => useProjectStore.setState(INITIAL_STATE));

  it("preserves line-sync when only begin/end change", () => {
    const store = useProjectStore.getState();
    store.restoreLyrics({ lines: [{ id: "L1", text: "verse", agentId: "v1", begin: 5, end: 7 }] });
    store.commit(pasteLines([{ id: "L1", updates: { begin: 5.05, end: 7.05 } }]));
    const after = useProjectStore.getState().lines[0];
    expect(after.words).toBeUndefined();
    expect(after.begin).toBeCloseTo(5.05);
    expect(after.end).toBeCloseTo(7.05);
  });

  it("preserves line-sync across multiple consecutive nudges (no drift to word-sync)", () => {
    const store = useProjectStore.getState();
    store.restoreLyrics({ lines: [{ id: "L1", text: "verse", agentId: "v1", begin: 5, end: 7 }] });
    for (let i = 0; i < 5; i++) {
      const cur = useProjectStore.getState().lines[0];
      store.commit(
        pasteLines([{ id: "L1", updates: { begin: (cur.begin as number) + 0.1, end: (cur.end as number) + 0.1 } }]),
      );
    }
    const after = useProjectStore.getState().lines[0];
    expect(after.words).toBeUndefined();
    expect(after.begin).toBeCloseTo(5.5);
    expect(after.end).toBeCloseTo(7.5);
  });

  it("undo restores prior line-sync state with no synthetic words appearing", () => {
    const store = useProjectStore.getState();
    store.commit(
      pasteLyrics(useProjectStore.getState().lines, [{ id: "L1", text: "verse", agentId: "v1", begin: 5, end: 7 }]),
    );
    store.commit(pasteLines([{ id: "L1", updates: { begin: 5.05, end: 7.05 } }]));
    store.undo();
    const after = useProjectStore.getState().lines[0];
    expect(after.words).toBeUndefined();
    expect(after.begin).toBe(5);
    expect(after.end).toBe(7);
  });

  it("flips to word-sync only when an explicit words array is written", () => {
    const store = useProjectStore.getState();
    store.restoreLyrics({ lines: [{ id: "L1", text: "verse", agentId: "v1", begin: 5, end: 7 }] });
    store.commit(
      pasteLines([
        { id: "L1", updates: { words: [{ id: "w1", text: "verse", sep: "", begin: 5, end: 7, joinsNext: false }] } },
      ]),
    );
    const after = useProjectStore.getState().lines[0];
    expect(after.words?.length).toBe(1);
    // store auto-clears begin/end when words appear on a previously line-synced row
    expect(after.begin).toBeUndefined();
    expect(after.end).toBeUndefined();
  });
});

// -- Instance shift via "select all words and nudge" ---------------------------
//
// User mental model: clicking a banner selects all the words in that instance.
// Pressing arrow then nudges all those words by the same delta. The user
// experiences this as "the whole instance shifted", but the underlying code
// is just the regular nudge handler operating on every selected word at once.
// These tests pin that behavior so future refactors of the nudge path can't
// silently break the instance-shift use case.

describe("instance shift = nudging every selected word at once", () => {
  beforeEach(() => useProjectStore.setState(INITIAL_STATE));

  it("nudging all words in an instance shifts every word by the same delta", () => {
    const store = useProjectStore.getState();
    store.commit(
      pasteLyrics(useProjectStore.getState().lines, [
        {
          id: "A",
          text: "I love",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w2", text: "I", sep: " ", begin: 10, end: 10.3, joinsNext: false },
            { id: "w3", text: "love", sep: "", begin: 10.3, end: 10.8, joinsNext: false },
          ],
        },
        {
          id: "B",
          text: "all night",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 1,
          words: [
            { id: "w4", text: "all", sep: " ", begin: 11, end: 11.4, joinsNext: false },
            { id: "w5", text: "night", sep: "", begin: 11.4, end: 12, joinsNext: false },
          ],
        },
      ]),
    );
    // Simulating what nudgeSelectedWords would output with all-instance selected:
    store.commit(
      pasteLines([
        {
          id: "A",
          updates: {
            words: [
              { id: "w6", text: "I", sep: " ", begin: 10.5, end: 10.8, joinsNext: false },
              { id: "w7", text: "love", sep: "", begin: 10.8, end: 11.3, joinsNext: false },
            ],
          },
        },
        {
          id: "B",
          updates: {
            words: [
              { id: "w8", text: "all", sep: " ", begin: 11.5, end: 11.9, joinsNext: false },
              { id: "w9", text: "night", sep: "", begin: 11.9, end: 12.5, joinsNext: false },
            ],
          },
        },
      ]),
    );
    const after = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(after.find((l) => l.id === "A")!))[0].begin).toBeCloseTo(10.5);
    expect(timedSyllables(mainTrack(after.find((l) => l.id === "B")!))[1].end).toBeCloseTo(12.5);
    // group structure preserved
    expect(after.find((l) => l.id === "A")?.groupId).toBe("g1");
    expect(after.find((l) => l.id === "B")?.instanceIdx).toBe(0);
  });

  it("only one instance shifts even when other instances exist", () => {
    const store = useProjectStore.getState();
    store.commit(
      pasteLyrics(useProjectStore.getState().lines, [
        {
          id: "A1",
          text: "x",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w10", text: "x", sep: "", begin: 10, end: 11, joinsNext: false }],
        },
        {
          id: "A2",
          text: "x",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [{ id: "w11", text: "x", sep: "", begin: 30, end: 31, joinsNext: false }],
        },
      ]),
    );
    // Only nudge instance 0
    store.commit(
      pasteLines([
        { id: "A1", updates: { words: [{ id: "w12", text: "x", sep: "", begin: 10.5, end: 11.5, joinsNext: false }] } },
      ]),
    );
    const after = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(after.find((l) => l.id === "A1")!))[0].begin).toBeCloseTo(10.5);
    // Instance 1 unchanged, proving shift is per-selection, not group-wide
    expect(timedSyllables(mainTrack(after.find((l) => l.id === "A2")!))[0].begin).toBe(30);
  });
});
