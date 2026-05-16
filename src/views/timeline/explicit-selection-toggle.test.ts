/**
 * @vitest-environment node
 */
import type { LyricLine } from "@/stores/project";
import { resolveExplicitSelectionToggle } from "@/views/timeline/explicit-selection-toggle";
import type { WordSelection } from "@/views/timeline/timeline-store";
import { describe, expect, it } from "vitest";

function sel(lineId: string, wordIndex: number, type: "word" | "bg" = "word"): WordSelection {
  return { lineId, lineIndex: 0, wordIndex, type };
}

describe("resolveExplicitSelectionToggle", () => {
  it("marks the whole word when a partially-marked syllable group is selected via one syllable", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "fu|cking yeah",
        agentId: "v1",
        words: [
          { text: "fu", begin: 0, end: 0.2, explicit: true },
          { text: "cking ", begin: 0.2, end: 0.5 },
          { text: "yeah", begin: 0.5, end: 1 },
        ],
      },
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel("L1", 0)]);
    expect(result.value).toBe(true);
    expect(result.targets.map((t) => t.wordIndex).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it("unmarks when every syllable of the selected word is already marked", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "fu|cking yeah",
        agentId: "v1",
        words: [
          { text: "fu", begin: 0, end: 0.2, explicit: true },
          { text: "cking ", begin: 0.2, end: 0.5, explicit: true },
          { text: "yeah", begin: 0.5, end: 1 },
        ],
      },
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel("L1", 1)]);
    expect(result.value).toBe(false);
    expect(result.targets.map((t) => t.wordIndex).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it("marks when the selected word is fully unmarked", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "fuck this",
        agentId: "v1",
        words: [
          { text: "fuck ", begin: 0, end: 0.5 },
          { text: "this", begin: 0.5, end: 1 },
        ],
      },
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel("L1", 0)]);
    expect(result.value).toBe(true);
    expect(result.targets).toEqual([{ lineId: "L1", field: "words", wordIndex: 0 }]);
  });

  it("treats a multi-line selection as marked-only-if every expanded index is marked", () => {
    const lines: LyricLine[] = [
      {
        id: "A",
        text: "fuck this",
        agentId: "v1",
        words: [
          { text: "fuck ", begin: 0, end: 0.5, explicit: true },
          { text: "this", begin: 0.5, end: 1 },
        ],
      },
      {
        id: "B",
        text: "shit happens",
        agentId: "v1",
        words: [
          { text: "shit ", begin: 1, end: 1.5 },
          { text: "happens", begin: 1.5, end: 2 },
        ],
      },
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel("A", 0), sel("B", 0)]);
    expect(result.value).toBe(true);
    expect(result.targets).toEqual([
      { lineId: "A", field: "words", wordIndex: 0 },
      { lineId: "B", field: "words", wordIndex: 0 },
    ]);
  });

  it("maps a bg-type selection to the backgroundWords field", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "main",
        agentId: "v1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundText: "oh shit",
        backgroundWords: [
          { text: "oh ", begin: 1, end: 1.25 },
          { text: "shit", begin: 1.25, end: 1.5 },
        ],
      },
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel("L1", 1, "bg")]);
    expect(result.value).toBe(true);
    expect(result.targets).toEqual([{ lineId: "L1", field: "backgroundWords", wordIndex: 1 }]);
  });

  it("drops out-of-range and unknown-line selections", () => {
    const lines: LyricLine[] = [
      {
        id: "L1",
        text: "fuck this",
        agentId: "v1",
        words: [
          { text: "fuck ", begin: 0, end: 0.5 },
          { text: "this", begin: 0.5, end: 1 },
        ],
      },
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel("L1", 9), sel("ghost", 0), sel("L1", 0)]);
    expect(result.targets).toEqual([{ lineId: "L1", field: "words", wordIndex: 0 }]);
  });

  it("returns an empty target list for an empty selection", () => {
    const result = resolveExplicitSelectionToggle([], []);
    expect(result.targets).toEqual([]);
  });
});
