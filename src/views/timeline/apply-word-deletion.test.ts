import { fieldsOfLine } from "@/domain/line/line-from-fields";

/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { pasteLines } from "@/domain/commands/instance-rows";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, roleWords, timedSyllables } from "@/domain/line/track";
import { applyWordDeletion, type DeletionSelection } from "@/domain/word/apply-word-deletion";
import { useProjectStore } from "@/stores/project";
import { fieldUpdates } from "@/test/field-updates";

describe("applyWordDeletion", () => {
  it("regression: deleting a timed word on a partly synced line keeps the untimed lyrics", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "every night in my dreams",
        agentId: "v1",
        words: [
          { id: "w1", text: "every", sep: " ", begin: 0, end: 0.3, joinsNext: false },
          { id: "w2", text: "night", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
          { id: "w3", text: "in", sep: " ", begin: 0.6, end: 1, joinsNext: false },
        ],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "l1", type: "word", wordIndex: 1 }]);
    expect(lineText(result[0])).toBe("every in my dreams");
  });

  it("removes selected words from a word-timed line, leaving the line in place", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "I love you",
        agentId: "v1",
        words: [
          { id: "w4", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
          { id: "w5", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
          { id: "w6", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
        ],
      }),
    ];
    const sel: DeletionSelection[] = [{ lineId: "l1", type: "word", wordIndex: 1 }];
    const result = applyWordDeletion(lines, sel);
    expect(result).toHaveLength(1);
    expect(timedSyllables(mainTrack(result[0])).map((w) => w.text + w.sep)).toEqual(["I ", "you"]);
  });

  it("leaves a word-timed line in place with no words AND clears begin/end when ALL words are deleted", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "I love",
        agentId: "v1",
        words: [
          { id: "w7", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
          { id: "w8", text: "love", sep: "", begin: 0.3, end: 0.6, joinsNext: false },
        ],
      }),
    ];
    const sel: DeletionSelection[] = [
      { lineId: "l1", type: "word", wordIndex: 0 },
      { lineId: "l1", type: "word", wordIndex: 1 },
    ];
    const result = applyWordDeletion(lines, sel);
    expect(result).toHaveLength(1);
    expect(roleWords(result[0], "main")).toBeUndefined();
    expect(mainTrack(result[0]).begin).toBeUndefined();
    expect(mainTrack(result[0]).end).toBeUndefined();
    expect(lineText(result[0])).toBe("I love");
  });

  it("clears begin/end on a word-timed line with no line-level timing too", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "I",
        agentId: "v1",
        words: [{ id: "w9", text: "I", sep: "", begin: 0, end: 1, joinsNext: false }],
      }),
    ];
    const sel: DeletionSelection[] = [{ lineId: "l1", type: "word", wordIndex: 0 }];
    const result = applyWordDeletion(lines, sel);
    expect(result).toHaveLength(1);
    expect(roleWords(result[0], "main")).toBeUndefined();
    expect(mainTrack(result[0]).begin).toBeUndefined();
  });

  it("clears a line-synced line's timing (no longer renders as line-synced) when synthetic word is deleted", () => {
    const lines: LyricLine[] = [lineFromFields({ id: "l1", text: "I love you", agentId: "v1", begin: 1, end: 2 })];
    const sel: DeletionSelection[] = [{ lineId: "l1", type: "word", wordIndex: 0 }];
    const result = applyWordDeletion(lines, sel);
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("I love you");
    expect(roleWords(result[0], "main")).toBeUndefined();
    expect(mainTrack(result[0]).begin).toBeUndefined();
    expect(mainTrack(result[0]).end).toBeUndefined();
  });

  it("clears multiple line-synced lines' timing when marquee-deleted (lines stay in project)", () => {
    const lines: LyricLine[] = [
      lineFromFields({ id: "l1", text: "first", agentId: "v1", begin: 0, end: 1 }),
      lineFromFields({ id: "l2", text: "second", agentId: "v1", begin: 1, end: 2 }),
      lineFromFields({ id: "l3", text: "third", agentId: "v1", begin: 2, end: 3 }),
    ];
    const sel: DeletionSelection[] = [
      { lineId: "l1", type: "word", wordIndex: 0 },
      { lineId: "l2", type: "word", wordIndex: 0 },
      { lineId: "l3", type: "word", wordIndex: 0 },
    ];
    const result = applyWordDeletion(lines, sel);
    expect(result).toHaveLength(3);
    for (const line of result) {
      expect(mainTrack(line).begin).toBeUndefined();
      expect(mainTrack(line).end).toBeUndefined();
      expect(roleWords(line, "main")).toBeUndefined();
    }
  });

  it("preserves line ordering and edits multiple lines without removing any", () => {
    const lines: LyricLine[] = [
      lineFromFields({ id: "keep1", text: "intact", agentId: "v1", begin: 0, end: 1 }),
      lineFromFields({
        id: "edit",
        text: "I love",
        agentId: "v1",
        words: [
          { id: "w10", text: "I", sep: " ", begin: 1, end: 1.3, joinsNext: false },
          { id: "w11", text: "love", sep: "", begin: 1.3, end: 1.6, joinsNext: false },
        ],
      }),
      lineFromFields({ id: "drop", text: "to clear", agentId: "v1", begin: 2, end: 3 }),
      lineFromFields({ id: "keep2", text: "intact 2", agentId: "v1", begin: 3, end: 4 }),
    ];
    const sel: DeletionSelection[] = [
      { lineId: "edit", type: "word", wordIndex: 0 },
      { lineId: "drop", type: "word", wordIndex: 0 },
    ];
    const result = applyWordDeletion(lines, sel);
    expect(result.map((l) => l.id)).toEqual(["keep1", "edit", "drop", "keep2"]);
    expect(timedSyllables(mainTrack(result[1])).map((w) => w.text)).toEqual(["love"]);
    expect(mainTrack(result[2]).begin).toBeUndefined();
    expect(mainTrack(result[2]).end).toBeUndefined();
    expect(roleWords(result[2], "main")).toBeUndefined();
    expect(lineText(result[2])).toBe("to clear");
  });

  it("removes selected bg words and clears the bg fields when none remain", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "main",
        agentId: "v1",
        words: [{ id: "w12", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundText: "bg",
        backgroundWords: [{ id: "w13", text: "bg", sep: "", begin: 0, end: 1, joinsNext: false }],
      }),
    ];
    const sel: DeletionSelection[] = [{ lineId: "l1", type: "bg", wordIndex: 0 }];
    const result = applyWordDeletion(lines, sel);
    expect(result).toHaveLength(1);
    expect(roleWords(result[0], "bg")).toBeUndefined();
    expect(backgroundText(result[0])).toBeUndefined();
    expect(roleWords(result[0], "main")?.length).toBe(1);
  });

  it("regression: deleting every timed bg word keeps the untimed rest of the background", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "main",
        agentId: "v1",
        words: [{ id: "w19", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundText: "stay with me",
        backgroundWords: [{ id: "w20", text: "stay", sep: " ", begin: 0, end: 0.5, joinsNext: false }],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "l1", type: "bg", wordIndex: 0 }]);
    expect(roleWords(result[0], "bg")).toBeUndefined();
    expect(backgroundText(result[0])).toBe("with me");
  });

  it("does not remove the line when only some bg words are removed", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "main",
        agentId: "v1",
        words: [{ id: "w14", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundText: "ohoh",
        backgroundWords: [
          { id: "w15", text: "oh", sep: "", begin: 0, end: 0.5, joinsNext: true },
          { id: "w16", text: "oh", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
      }),
    ];
    const sel: DeletionSelection[] = [{ lineId: "l1", type: "bg", wordIndex: 0 }];
    const result = applyWordDeletion(lines, sel);
    expect(result).toHaveLength(1);
    expect(timedSyllables(backgroundTrack(result[0])).map((w) => w.text)).toEqual(["oh"]);
    expect(backgroundText(result[0])).toBe("oh");
  });

  it("clears backgroundTextSource when the deletion empties the background", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "main",
        agentId: "v1",
        words: [{ id: "w17", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundText: "bg",
        backgroundWords: [{ id: "w18", text: "bg", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundTextSource: "extraction",
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "l1", type: "bg", wordIndex: 0 }]);
    expect(roleWords(result[0], "bg")).toBeUndefined();
    expect(backgroundText(result[0])).toBeUndefined();
    expect(backgroundTrack(result[0])?.source).toBeUndefined();
  });

  it("stamps backgroundTextSource manual when a partial bg deletion leaves words behind", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "main",
        agentId: "v1",
        words: [{ id: "w19", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundText: "ohoh",
        backgroundWords: [
          { id: "w20", text: "oh", sep: "", begin: 0, end: 0.5, joinsNext: true },
          { id: "w21", text: "oh", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
        backgroundTextSource: "extraction",
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "l1", type: "bg", wordIndex: 0 }]);
    expect(timedSyllables(backgroundTrack(result[0])).map((w) => w.text)).toEqual(["oh"]);
    expect(backgroundTrack(result[0])?.source).toBe("manual");
  });

  it("leaves backgroundTextSource untouched when only main words are deleted", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "I love",
        agentId: "v1",
        words: [
          { id: "w22", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
          { id: "w23", text: "love", sep: "", begin: 0.3, end: 0.6, joinsNext: false },
        ],
        backgroundText: "ohoh",
        backgroundWords: [
          { id: "w24", text: "oh", sep: "", begin: 0, end: 0.5, joinsNext: true },
          { id: "w25", text: "oh", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
        backgroundTextSource: "extraction",
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "l1", type: "word", wordIndex: 0 }]);
    expect(timedSyllables(mainTrack(result[0])).map((w) => w.text)).toEqual(["love"]);
    expect(roleWords(result[0], "bg")?.length).toBe(2);
    expect(backgroundTrack(result[0])?.source).toBe("extraction");
  });

  it("leaves a word-timed line empty (not removed) when all main + bg words are deleted in one pass", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "I",
        agentId: "v1",
        words: [{ id: "w26", text: "I", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundText: "ah",
        backgroundWords: [{ id: "w27", text: "ah", sep: "", begin: 0, end: 1, joinsNext: false }],
      }),
    ];
    const sel: DeletionSelection[] = [
      { lineId: "l1", type: "word", wordIndex: 0 },
      { lineId: "l1", type: "bg", wordIndex: 0 },
    ];
    const result = applyWordDeletion(lines, sel);
    expect(result).toHaveLength(1);
    expect(roleWords(result[0], "main")).toBeUndefined();
    expect(roleWords(result[0], "bg")).toBeUndefined();
    expect(mainTrack(result[0]).begin).toBeUndefined();
    expect(mainTrack(result[0]).end).toBeUndefined();
  });

  it("returns the original array when there are no selections", () => {
    const lines: LyricLine[] = [lineFromFields({ id: "l1", text: "x", agentId: "v1" })];
    expect(applyWordDeletion(lines, [])).toBe(lines);
  });

  it("ignores selections referencing missing lines", () => {
    const lines: LyricLine[] = [lineFromFields({ id: "l1", text: "x", agentId: "v1", begin: 0, end: 1 })];
    const sel: DeletionSelection[] = [{ lineId: "ghost", type: "word", wordIndex: 0 }];
    const result = applyWordDeletion(lines, sel);
    expect(result).toEqual(lines);
  });

  it("preserves pre-existing intra-group gaps after deleting a non-group word", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "l1",
        text: "every world",
        agentId: "v1",
        words: [
          { id: "w28", text: "ev", sep: "", begin: 0, end: 0.2, joinsNext: true },
          { id: "w29", text: "er", sep: "", begin: 0.3, end: 0.5, joinsNext: true },
          { id: "w30", text: "y", sep: "", begin: 0.5, end: 0.7, joinsNext: false },
          { id: "w31", text: "world", sep: "", begin: 0.7, end: 1, joinsNext: false },
        ],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "l1", type: "word", wordIndex: 3 }]);
    expect(timedSyllables(mainTrack(result[0]))[0].end).toBe(0.2);
    expect(timedSyllables(mainTrack(result[0]))[1].begin).toBe(0.3);
  });
});

// -- Auto-cleanup of fully-empty instances ------------------------------------
//
// When every line of an instance is emptied of all timed content (no words,
// no bg words, no begin/end), strip the group attrs from those lines. The
// rows remain as standalone empty placeholders for the existing Cmd+D / paste
// fill flow to repopulate later. Without this, the instance lingered in the
// data model and rendered a confusing zero-bounds banner at x=0.

describe("applyWordDeletion · auto-cleanup of fully-empty grouped instances", () => {
  it("strips group attrs when a single-line instance has its only word deleted", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "x",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ id: "w32", text: "x", sep: "", begin: 5, end: 6, joinsNext: false }],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "L1", type: "word", wordIndex: 0 }]);
    expect(result[0].groupId).toBeUndefined();
    expect(result[0].instanceIdx).toBeUndefined();
    expect(result[0].templateLineIdx).toBeUndefined();
    // Row remains as an empty placeholder (text and id preserved)
    expect(result[0].id).toBe("L1");
    expect(lineText(result[0])).toBe("x");
    // Existing applyWordDeletion contract: words becomes [] after deleting all words
    expect(roleWords(result[0], "main")).toBeUndefined();
    expect(mainTrack(result[0]).begin).toBeUndefined();
    expect(mainTrack(result[0]).end).toBeUndefined();
  });

  it("strips group attrs from ALL lines of a multi-line instance when every line is emptied", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "A1",
        text: "I love",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [
          { id: "w33", text: "I", sep: " ", begin: 5, end: 5.5, joinsNext: false },
          { id: "w34", text: "love", sep: "", begin: 5.5, end: 6, joinsNext: false },
        ],
      }),
      lineFromFields({
        id: "A2",
        text: "you",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 1,
        words: [{ id: "w35", text: "you", sep: "", begin: 6, end: 7, joinsNext: false }],
      }),
    ];
    const result = applyWordDeletion(lines, [
      { lineId: "A1", type: "word", wordIndex: 0 },
      { lineId: "A1", type: "word", wordIndex: 1 },
      { lineId: "A2", type: "word", wordIndex: 0 },
    ]);
    expect(result.every((l) => l.groupId === undefined)).toBe(true);
    expect(result.every((l) => l.instanceIdx === undefined)).toBe(true);
    expect(result.every((l) => l.templateLineIdx === undefined)).toBe(true);
  });

  it("keeps group attrs intact when only SOME lines of a multi-line instance are emptied", () => {
    // A1 gets emptied, A2 still has words. Instance is not fully empty → keep linked.
    const lines: LyricLine[] = [
      lineFromFields({
        id: "A1",
        text: "I love",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ id: "w36", text: "I love", sep: "", begin: 5, end: 6, joinsNext: false }],
      }),
      lineFromFields({
        id: "A2",
        text: "you",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 1,
        words: [{ id: "w37", text: "you", sep: "", begin: 6, end: 7, joinsNext: false }],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "A1", type: "word", wordIndex: 0 }]);
    // A1 is now empty but A2 still has words → instance stays alive
    expect(result.find((l) => l.id === "A1")?.groupId).toBe("cannon");
    expect(result.find((l) => l.id === "A2")?.groupId).toBe("cannon");
    expect(
      roleWords(
        result.find((l) => l.id === "A1"),
        "main",
      ),
    ).toBeUndefined();
    expect(timedSyllables(mainTrack(result.find((l) => l.id === "A2")!))).toEqual([
      { text: "you", sep: "", begin: 6, end: 7, joinsNext: false },
    ]);
  });

  it("strips group attrs when a single-line instance has only BG words and they all get deleted", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "main",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        backgroundText: "ah ah",
        backgroundWords: [
          { id: "w38", text: "ah", sep: " ", begin: 5, end: 5.5, joinsNext: false },
          { id: "w39", text: "ah", sep: "", begin: 5.5, end: 6, joinsNext: false },
        ],
      }),
    ];
    const result = applyWordDeletion(lines, [
      { lineId: "L1", type: "bg", wordIndex: 0 },
      { lineId: "L1", type: "bg", wordIndex: 1 },
    ]);
    expect(result[0].groupId).toBeUndefined();
    expect(roleWords(result[0], "bg")).toBeUndefined();
  });

  it("keeps group attrs when a line has main + bg and only one track is emptied (other still has content)", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "main",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ id: "w40", text: "main", sep: "", begin: 5, end: 6, joinsNext: false }],
        backgroundText: "ah",
        backgroundWords: [{ id: "w41", text: "ah", sep: "", begin: 5, end: 5.5, joinsNext: false }],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "L1", type: "word", wordIndex: 0 }]);
    // Main words gone but bg still present → not fully empty → instance stays
    expect(result[0].groupId).toBe("cannon");
    expect(roleWords(result[0], "main")).toBeUndefined();
    expect(roleWords(result[0], "bg")?.length).toBe(1);
  });

  it("strips group attrs from a line-synced (no words, has begin/end) instance when its single line is deleted", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "verse",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        begin: 5,
        end: 7,
      }),
    ];
    // Selecting wordIndex 0 on a line-synced row deletes the synthetic word AND clears begin/end
    const result = applyWordDeletion(lines, [{ lineId: "L1", type: "word", wordIndex: 0 }]);
    expect(result[0].groupId).toBeUndefined();
    expect(mainTrack(result[0]).begin).toBeUndefined();
    expect(mainTrack(result[0]).end).toBeUndefined();
  });

  it("handles two separate instances both becoming empty in one deletion call", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "A1",
        text: "x",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [{ id: "w42", text: "x", sep: "", begin: 5, end: 6, joinsNext: false }],
      }),
      lineFromFields({
        id: "B1",
        text: "y",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ id: "w43", text: "y", sep: "", begin: 10, end: 11, joinsNext: false }],
      }),
    ];
    const result = applyWordDeletion(lines, [
      { lineId: "A1", type: "word", wordIndex: 0 },
      { lineId: "B1", type: "word", wordIndex: 0 },
    ]);
    expect(result.every((l) => l.groupId === undefined)).toBe(true);
  });

  it("does NOT touch instances that weren't part of the deletion selection", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "A1",
        text: "x",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [{ id: "w44", text: "x", sep: "", begin: 5, end: 6, joinsNext: false }],
      }),
      lineFromFields({
        id: "B1",
        text: "y",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [{ id: "w45", text: "y", sep: "", begin: 10, end: 11, joinsNext: false }],
      }),
    ];
    // Only delete A1's word, not B1's
    const result = applyWordDeletion(lines, [{ lineId: "A1", type: "word", wordIndex: 0 }]);
    expect(result.find((l) => l.id === "A1")?.groupId).toBeUndefined();
    expect(result.find((l) => l.id === "B1")?.groupId).toBe("cannon");
  });

  it("non-grouped lines that get fully emptied: nothing to strip, just left as empty rows", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "x",
        agentId: "v1",
        words: [{ id: "w46", text: "x", sep: "", begin: 5, end: 6, joinsNext: false }],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "L1", type: "word", wordIndex: 0 }]);
    expect(result[0].groupId).toBeUndefined();
    expect(roleWords(result[0], "main")).toBeUndefined();
    expect(result[0].id).toBe("L1");
    expect(lineText(result[0])).toBe("x");
  });

  it("preserves the detached flag's semantics when stripping (detached lines also clear it)", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "x",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        detached: true,
        words: [{ id: "w47", text: "x", sep: "", begin: 5, end: 6, joinsNext: false }],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "L1", type: "word", wordIndex: 0 }]);
    expect(result[0].groupId).toBeUndefined();
    expect(result[0].detached).toBeUndefined();
  });

  it("partial deletion (some words remain): instance stays linked", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "I love you",
        agentId: "v1",
        groupId: "cannon",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [
          { id: "w48", text: "I", sep: " ", begin: 5, end: 5.3, joinsNext: false },
          { id: "w49", text: "love", sep: " ", begin: 5.3, end: 5.6, joinsNext: false },
          { id: "w50", text: "you", sep: "", begin: 5.6, end: 6, joinsNext: false },
        ],
      }),
    ];
    const result = applyWordDeletion(lines, [{ lineId: "L1", type: "word", wordIndex: 1 }]);
    expect(result[0].groupId).toBe("cannon");
    expect(roleWords(result[0], "main")?.length).toBe(2);
  });
});

describe("applyWordDeletion · regressions", () => {
  it("regression: Place times a grouped line after all its words are deleted (#280)", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "c1",
        text: "hold me",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { id: "w51", text: "hold", sep: " ", begin: 4, end: 4.5, joinsNext: false },
          { id: "w52", text: "me", sep: "", begin: 4.5, end: 5, joinsNext: false },
        ],
      }),
    ];
    const deleted = applyWordDeletion(lines, [
      { lineId: "c1", type: "word", wordIndex: 0 },
      { lineId: "c1", type: "word", wordIndex: 1 },
    ]);
    useProjectStore.setState({ lines: deleted, groups: [] });

    useProjectStore.getState().commit(pasteLines(fieldUpdates([{ id: "c1", updates: { begin: 7, end: 8 } }])));

    expect(fieldsOfLine(useProjectStore.getState().lines[0])).toMatchObject({ begin: 7, end: 8 });
    expect(roleWords(useProjectStore.getState().lines[0], "main")).toBeUndefined();
  });
});
