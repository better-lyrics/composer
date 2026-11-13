/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it } from "vitest";
import { markWordsExplicit } from "@/domain/commands/word-edits";
import type { LinkGroup } from "@/domain/group/template";
import { drawnSyllables } from "@/domain/line/drawn-track";
import { lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { roleWords, trackRole } from "@/domain/line/track";
import type { SyllableAddress } from "@/domain/selection/model";
import { newWordId } from "@/domain/word/id";
import { useProjectStore } from "@/stores/project";
import { createWords } from "@/test/factories";
import { resolveExplicitSelectionToggle } from "@/views/timeline/explicit-selection-toggle";

function sel(lines: LyricLine[], lineId: string, wordIndex: number, type: "word" | "bg" = "word"): SyllableAddress {
  const line = lines.find((candidate) => candidate.id === lineId);
  const word = line ? drawnSyllables(line, trackRole(type))[wordIndex] : undefined;
  return { lineId, type, syllableId: word?.id ?? `missing-${wordIndex}` };
}

describe("resolveExplicitSelectionToggle", () => {
  it("marks the whole word when a partially-marked syllable group is selected via one syllable", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "fu|cking yeah",
        agentId: "v1",
        words: [
          { id: "w1", text: "fu", sep: "", begin: 0, end: 0.2, explicit: true, joinsNext: true },
          { id: "w2", text: "cking", sep: " ", begin: 0.2, end: 0.5, joinsNext: false },
          { id: "w3", text: "yeah", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
      }),
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel(lines, "L1", 0)]);
    expect(result.value).toBe(true);
    expect(result.targets.map((t) => t.wordIndex).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it("unmarks when every syllable of the selected word is already marked", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "fu|cking yeah",
        agentId: "v1",
        words: [
          { id: "w4", text: "fu", sep: "", begin: 0, end: 0.2, explicit: true, joinsNext: true },
          { id: "w5", text: "cking", sep: " ", begin: 0.2, end: 0.5, explicit: true, joinsNext: false },
          { id: "w6", text: "yeah", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
      }),
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel(lines, "L1", 1)]);
    expect(result.value).toBe(false);
    expect(result.targets.map((t) => t.wordIndex).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it("marks when the selected word is fully unmarked", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "fuck this",
        agentId: "v1",
        words: [
          { id: "w7", text: "fuck", sep: " ", begin: 0, end: 0.5, joinsNext: false },
          { id: "w8", text: "this", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
      }),
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel(lines, "L1", 0)]);
    expect(result.value).toBe(true);
    expect(result.targets).toEqual([{ lineId: "L1", field: "words", wordIndex: 0 }]);
  });

  it("treats a multi-line selection as marked-only-if every expanded index is marked", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "A",
        text: "fuck this",
        agentId: "v1",
        words: [
          { id: "w9", text: "fuck", sep: " ", begin: 0, end: 0.5, explicit: true, joinsNext: false },
          { id: "w10", text: "this", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
      }),
      lineFromFields({
        id: "B",
        text: "shit happens",
        agentId: "v1",
        words: [
          { id: "w11", text: "shit", sep: " ", begin: 1, end: 1.5, joinsNext: false },
          { id: "w12", text: "happens", sep: "", begin: 1.5, end: 2, joinsNext: false },
        ],
      }),
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel(lines, "A", 0), sel(lines, "B", 0)]);
    expect(result.value).toBe(true);
    expect(result.targets).toEqual([
      { lineId: "A", field: "words", wordIndex: 0 },
      { lineId: "B", field: "words", wordIndex: 0 },
    ]);
  });

  it("maps a bg-type selection to the backgroundWords field", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "main",
        agentId: "v1",
        words: [{ id: "w13", text: "main", sep: "", begin: 0, end: 1, joinsNext: false }],
        backgroundText: "oh shit",
        backgroundWords: [
          { id: "w14", text: "oh", sep: " ", begin: 1, end: 1.25, joinsNext: false },
          { id: "w15", text: "shit", sep: "", begin: 1.25, end: 1.5, joinsNext: false },
        ],
      }),
    ];
    const result = resolveExplicitSelectionToggle(lines, [sel(lines, "L1", 1, "bg")]);
    expect(result.value).toBe(true);
    expect(result.targets).toEqual([{ lineId: "L1", field: "backgroundWords", wordIndex: 1 }]);
  });

  it("drops out-of-range and unknown-line selections", () => {
    const lines: LyricLine[] = [
      lineFromFields({
        id: "L1",
        text: "fuck this",
        agentId: "v1",
        words: [
          { id: "w16", text: "fuck", sep: " ", begin: 0, end: 0.5, joinsNext: false },
          { id: "w17", text: "this", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
      }),
    ];
    const result = resolveExplicitSelectionToggle(lines, [
      sel(lines, "L1", 9),
      sel(lines, "ghost", 0),
      sel(lines, "L1", 0),
    ]);
    expect(result.targets).toEqual([{ lineId: "L1", field: "words", wordIndex: 0 }]);
  });

  it("returns an empty target list for an empty selection", () => {
    const result = resolveExplicitSelectionToggle([], []);
    expect(result.targets).toEqual([]);
  });
});

describe("resolveExplicitSelectionToggle → markWordsExplicit (keyboard flow, issue #62 Bug 2)", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useProjectStore.getState().clearHistory();
  });

  function seedLinkedChorus(explicit = false) {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    useProjectStore.getState().restoreLyrics({
      lines: [0, 1, 2].map((idx) =>
        lineFromFields({
          id: `inst-${idx}`,
          text: "fuck this",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: idx,
          templateLineIdx: 0,
          words: createWords([
            {
              id: newWordId(),
              text: "fuck",
              sep: " ",
              begin: idx * 30,
              end: idx * 30 + 0.5,
              ...(explicit ? { explicit: true as const } : {}),
            },
            { id: newWordId(), text: "this", sep: "", begin: idx * 30 + 0.5, end: idx * 30 + 1 },
          ]),
        }),
      ),
    });
  }

  function runToggle(): void {
    const { lines } = useProjectStore.getState();
    const selection = [sel(lines, "inst-0", 0), sel(lines, "inst-1", 0), sel(lines, "inst-2", 0)];
    const { targets, value } = resolveExplicitSelectionToggle(lines, selection);
    useProjectStore.getState().commit(markWordsExplicit(targets, value));
  }

  it("marks the word across every linked instance instead of flip-flopping", () => {
    seedLinkedChorus();
    runToggle();
    const lines = useProjectStore.getState().lines;
    expect(lines.every((l) => roleWords(l, "main")?.[0].explicit === true)).toBe(true);
  });

  it("reverts the whole batch with a single undo", () => {
    seedLinkedChorus();
    runToggle();
    useProjectStore.getState().undo();
    const lines = useProjectStore.getState().lines;
    expect(lines.every((l) => roleWords(l, "main")?.[0].explicit === undefined)).toBe(true);
  });

  it("unmarks the batch when every selected word is already explicit", () => {
    seedLinkedChorus(true);
    runToggle();
    const lines = useProjectStore.getState().lines;
    expect(lines.every((l) => roleWords(l, "main")?.[0].explicit === undefined)).toBe(true);
  });
});
