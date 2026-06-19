/**
 * @vitest-environment node
 */
import { computeExplicitToggle } from "@/domain/word/explicit-toggle";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

function words(): WordTiming[] {
  return [
    { text: "I ", begin: 0, end: 0.5 },
    { text: "love ", begin: 0.5, end: 1 },
    { text: "you", begin: 1, end: 1.5 },
  ];
}

describe("computeExplicitToggle · marking", () => {
  it("marks the selected word explicit when none are marked", () => {
    const result = computeExplicitToggle(words(), "words", [1]);
    expect(result?.newWords.map((w) => w.explicit)).toEqual([undefined, true, undefined]);
  });

  it("marks all selected when several are unmarked", () => {
    const result = computeExplicitToggle(words(), "words", [0, 2]);
    expect(result?.newWords.map((w) => w.explicit)).toEqual([true, undefined, true]);
  });
});

describe("computeExplicitToggle · unmarking", () => {
  it("unmarks when every selected word is already explicit", () => {
    const marked = words().map((w) => ({ ...w, explicit: true as const }));
    const result = computeExplicitToggle(marked, "words", [0, 1, 2]);
    expect(result?.newWords.every((w) => w.explicit === undefined)).toBe(true);
  });

  it("marks the rest when the selection is mixed (not all marked)", () => {
    const mixed: WordTiming[] = [
      { text: "I ", begin: 0, end: 0.5, explicit: true },
      { text: "love ", begin: 0.5, end: 1 },
      { text: "you", begin: 1, end: 1.5 },
    ];
    const result = computeExplicitToggle(mixed, "words", [0, 1]);
    expect(result?.newWords[0].explicit).toBe(true);
    expect(result?.newWords[1].explicit).toBe(true);
  });
});

describe("computeExplicitToggle · syllable group expansion", () => {
  it("expands the selection to every word in a syllable group", () => {
    const grouped: WordTiming[] = [
      { text: "ev", begin: 0, end: 0.3, syllableGroupId: "g" },
      { text: "er", begin: 0.3, end: 0.6, syllableGroupId: "g" },
      { text: "y", begin: 0.6, end: 1, syllableGroupId: "g" },
    ];
    const result = computeExplicitToggle(grouped, "words", [1]);
    expect(result?.newWords.map((w) => w.explicit)).toEqual([true, true, true]);
  });
});

describe("computeExplicitToggle · background provenance", () => {
  it("stamps manual provenance for a backgroundWords edit", () => {
    const result = computeExplicitToggle(words(), "backgroundWords", [0]);
    expect(result?.extraUpdates.backgroundTextSource).toBe("manual");
    expect(result?.extraUpdates.backgroundWords).toBeDefined();
  });

  it("returns no extra updates for a main-words edit", () => {
    const result = computeExplicitToggle(words(), "words", [0]);
    expect(result?.extraUpdates).toEqual({});
  });
});

describe("computeExplicitToggle · null paths", () => {
  it("returns null for an empty word array", () => {
    expect(computeExplicitToggle([], "words", [0])).toBeNull();
  });

  it("returns null when no indices fall in range", () => {
    expect(computeExplicitToggle(words(), "words", [9, -1])).toBeNull();
  });

  it("returns null for an empty selection", () => {
    expect(computeExplicitToggle(words(), "words", [])).toBeNull();
  });
});

describe("computeExplicitToggle · invariants", () => {
  it("does not mutate the input word array", () => {
    const input = words();
    const snapshot = input.map((w) => ({ ...w }));
    computeExplicitToggle(input, "words", [0, 1]);
    expect(input).toEqual(snapshot);
  });

  it("preserves text and timing on every word", () => {
    const result = computeExplicitToggle(words(), "words", [1]);
    expect(result?.newWords.map((w) => [w.text, w.begin, w.end])).toEqual([
      ["I ", 0, 0.5],
      ["love ", 0.5, 1],
      ["you", 1, 1.5],
    ]);
  });
});
