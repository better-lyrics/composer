import type { LineTemplate, LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText } from "@/domain/line/text";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
/**
 * @vitest-environment node
 */
import { useProjectStore } from "@/stores/project";
import { beforeEach, describe, expect, it } from "vitest";
import { markWordsExplicit, toggleWordExplicit } from "@/domain/commands/word-edits";
import { addInstance } from "@/domain/commands/instance-edits";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedSingleLine(line: LyricLine) {
  useProjectStore.getState().restoreLyrics({ lines: [line] });
}

describe("toggleWordExplicit · single line", () => {
  it("sets explicit: true on a previously unmarked word", () => {
    seedSingleLine({
      id: "L1",
      text: "I fuck you",
      agentId: "v1",
      words: [
        { id: "w1", text: "I", sep: " ", begin: 0, end: 0.3 },
        { id: "w2", text: "fuck", sep: " ", begin: 0.3, end: 0.6 },
        { id: "w3", text: "you", sep: "", begin: 0.6, end: 1 },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("L1", "words", [1]));
    const updated = useProjectStore.getState().lines[0];
    expect(timedSyllables(mainTrack(updated))[0].explicit).toBeUndefined();
    expect(timedSyllables(mainTrack(updated))[1].explicit).toBe(true);
    expect(timedSyllables(mainTrack(updated))[2].explicit).toBeUndefined();
  });

  it("removes the explicit key (does not store false) when toggling a marked word", () => {
    seedSingleLine({
      id: "L1",
      text: "fuck",
      agentId: "v1",
      words: [{ id: "w4", text: "fuck", sep: "", begin: 0, end: 1, explicit: true }],
    });
    useProjectStore.getState().commit(toggleWordExplicit("L1", "words", [0]));
    const word = timedSyllables(mainTrack(useProjectStore.getState().lines[0]))[0];
    expect("explicit" in word).toBe(false);
  });

  it("marks all targeted words when at least one is unmarked", () => {
    seedSingleLine({
      id: "L1",
      text: "a b c",
      agentId: "v1",
      words: [
        { id: "w5", text: "a", sep: " ", begin: 0, end: 0.3 },
        { id: "w6", text: "b", sep: " ", begin: 0.3, end: 0.6, explicit: true },
        { id: "w7", text: "c", sep: "", begin: 0.6, end: 1 },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("L1", "words", [0, 1, 2]));
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[0].explicit).toBe(true);
    expect(words[1].explicit).toBe(true);
    expect(words[2].explicit).toBe(true);
  });

  it("unmarks all targeted words when every one is already marked", () => {
    seedSingleLine({
      id: "L1",
      text: "a b c",
      agentId: "v1",
      words: [
        { id: "w8", text: "a", sep: " ", begin: 0, end: 0.3, explicit: true },
        { id: "w9", text: "b", sep: " ", begin: 0.3, end: 0.6, explicit: true },
        { id: "w10", text: "c", sep: "", begin: 0.6, end: 1 },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("L1", "words", [0, 1]));
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[0].explicit).toBeUndefined();
    expect(words[1].explicit).toBeUndefined();
  });

  it("operates on backgroundWords when field='backgroundWords'", () => {
    seedSingleLine({
      id: "L1",
      text: "main",
      agentId: "v1",
      words: [{ id: "w11", text: "main", sep: "", begin: 0, end: 1 }],
      backgroundText: "oh shit",
      backgroundWords: [
        { id: "w12", text: "oh", sep: " ", begin: 1, end: 1.25 },
        { id: "w13", text: "shit", sep: "", begin: 1.25, end: 1.5 },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("L1", "backgroundWords", [1]));
    const line = useProjectStore.getState().lines[0];
    expect(timedSyllables(mainTrack(line))[0].explicit).toBeUndefined();
    expect(timedSyllables(backgroundTrack(line))[0].explicit).toBeUndefined();
    expect(timedSyllables(backgroundTrack(line))[1].explicit).toBe(true);
  });
});

describe("toggleWordExplicit · linked-line propagation", () => {
  function seedLinkedGroup() {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "A",
          text: "I fuck you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w14", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w15", text: "fuck", sep: " ", begin: 0.3, end: 0.6 },
            { id: "w16", text: "you", sep: "", begin: 0.6, end: 1 },
          ],
        },
        {
          id: "B",
          text: "I fuck you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w17", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w18", text: "fuck", sep: " ", begin: 30.4, end: 30.7 },
            { id: "w19", text: "you", sep: "", begin: 30.7, end: 31.2 },
          ],
        },
      ],
    });
  }

  it("propagates the flag to linked siblings while preserving sibling timing", () => {
    seedLinkedGroup();
    useProjectStore.getState().commit(toggleWordExplicit("A", "words", [1]));
    const lines = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(lines[0]))[1].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[1]))[1].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[1]))[1].begin).toBeCloseTo(30.4);
    expect(timedSyllables(mainTrack(lines[1]))[1].end).toBeCloseTo(30.7);
  });

  it("does not propagate to detached siblings", () => {
    seedLinkedGroup();
    useProjectStore.getState().restoreLyrics({
      lines: useProjectStore.getState().lines.map((l) => (l.id === "B" ? { ...l, detached: true } : l)),
    });
    useProjectStore.getState().commit(toggleWordExplicit("A", "words", [1]));
    const lines = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(lines[0]))[1].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[1]))[1].explicit).toBeUndefined();
  });

  it("clears the flag on siblings when source unmarks", () => {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "A",
          text: "I fuck you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w20", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w21", text: "fuck", sep: " ", begin: 0.3, end: 0.6, explicit: true },
            { id: "w22", text: "you", sep: "", begin: 0.6, end: 1 },
          ],
        },
        {
          id: "B",
          text: "I fuck you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w23", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w24", text: "fuck", sep: " ", begin: 30.4, end: 30.7, explicit: true },
            { id: "w25", text: "you", sep: "", begin: 30.7, end: 31.2 },
          ],
        },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("A", "words", [1]));
    const lines = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(lines[0]))[1].explicit).toBeUndefined();
    expect(timedSyllables(mainTrack(lines[1]))[1].explicit).toBeUndefined();
  });
});

describe("addInstance · template materialization carries explicit", () => {
  it("carries explicit from WordTemplate onto the materialized WordTiming (words)", () => {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    const structure: LineTemplate[] = [
      {
        text: "I fuck you",
        agentId: "v1",
        relativeBegin: 0,
        relativeEnd: 1,
        words: [
          { text: "I", sep: " ", relativeBegin: 0, relativeEnd: 0.3 },
          { text: "fuck", sep: " ", relativeBegin: 0.3, relativeEnd: 0.6, explicit: true },
          { text: "you", sep: "", relativeBegin: 0.6, relativeEnd: 1 },
        ],
      },
    ];
    useProjectStore.getState().commit(addInstance("g1", structure, 30));
    const line = useProjectStore.getState().lines.find((l) => l.groupId === "g1");
    expect(line).toBeDefined();
    expect(timedSyllables(mainTrack(line!))[0].explicit).toBeUndefined();
    expect(timedSyllables(mainTrack(line!))[1].explicit).toBe(true);
    expect(timedSyllables(mainTrack(line!))[1].begin).toBeCloseTo(30.3);
    expect(timedSyllables(mainTrack(line!))[2].explicit).toBeUndefined();
  });

  it("carries explicit from WordTemplate onto backgroundWords", () => {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    const structure: LineTemplate[] = [
      {
        text: "main",
        agentId: "v1",
        relativeBegin: 0,
        relativeEnd: 1,
        words: [{ text: "main", sep: "", relativeBegin: 0, relativeEnd: 1 }],
        backgroundText: "oh shit",
        backgroundWords: [
          { text: "oh", sep: " ", relativeBegin: 0, relativeEnd: 0.5 },
          { text: "shit", sep: "", relativeBegin: 0.5, relativeEnd: 1, explicit: true },
        ],
      },
    ];
    useProjectStore.getState().commit(addInstance("g1", structure, 10));
    const line = useProjectStore.getState().lines.find((l) => l.groupId === "g1");
    expect(timedSyllables(backgroundTrack(line!))[0].explicit).toBeUndefined();
    expect(timedSyllables(backgroundTrack(line!))[1].explicit).toBe(true);
    expect(timedSyllables(backgroundTrack(line!))[1].begin).toBeCloseTo(10.5);
  });
});

describe("toggleWordExplicit · history", () => {
  it("creates a history entry so undo restores the previous flag state", () => {
    seedSingleLine({
      id: "L1",
      text: "fuck",
      agentId: "v1",
      words: [{ id: "w26", text: "fuck", sep: "", begin: 0, end: 1 }],
    });
    useProjectStore.getState().commit(toggleWordExplicit("L1", "words", [0]));
    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))[0].explicit).toBe(true);
    useProjectStore.getState().undo();
    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))[0].explicit).toBeUndefined();
  });
});

describe("toggleWordExplicit · syllable expansion (issue #62)", () => {
  it("marks every syllable of a multi-syllable word when one syllable is targeted", () => {
    seedSingleLine({
      id: "L1",
      text: "I fu|cking love it",
      agentId: "v1",
      words: [
        { id: "w27", text: "I", sep: " ", begin: 0, end: 0.3 },
        { id: "w28", text: "fu", sep: "", begin: 0.3, end: 0.4 },
        { id: "w29", text: "cking", sep: " ", begin: 0.4, end: 0.6 },
        { id: "w30", text: "love", sep: " ", begin: 0.6, end: 0.8 },
        { id: "w31", text: "it", sep: "", begin: 0.8, end: 1 },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("L1", "words", [1]));
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[1].explicit).toBe(true);
    expect(words[2].explicit).toBe(true);
    expect(words[0].explicit).toBeUndefined();
    expect(words[3].explicit).toBeUndefined();
  });

  it("unmarks every syllable of a multi-syllable word when all are marked", () => {
    seedSingleLine({
      id: "L1",
      text: "fu|cking",
      agentId: "v1",
      words: [
        { id: "w32", text: "fu", sep: "", begin: 0, end: 0.5, explicit: true },
        { id: "w33", text: "cking", sep: "", begin: 0.5, end: 1, explicit: true },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("L1", "words", [1]));
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[0].explicit).toBeUndefined();
    expect(words[1].explicit).toBeUndefined();
  });

  it("expansion propagates to every syllable on linked siblings", () => {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "A",
          text: "fu|cking yeah",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w34", text: "fu", sep: "", begin: 0, end: 0.2 },
            { id: "w35", text: "cking", sep: " ", begin: 0.2, end: 0.5 },
            { id: "w36", text: "yeah", sep: "", begin: 0.5, end: 1 },
          ],
        },
        {
          id: "B",
          text: "fu|cking yeah",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w37", text: "fu", sep: "", begin: 30, end: 30.2 },
            { id: "w38", text: "cking", sep: " ", begin: 30.2, end: 30.5 },
            { id: "w39", text: "yeah", sep: "", begin: 30.5, end: 31 },
          ],
        },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("A", "words", [0]));
    const lines = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(lines[0]))[0].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[0]))[1].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[1]))[0].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[1]))[1].explicit).toBe(true);
  });
});

describe("markWordsExplicit · syllable + batch (issue #62)", () => {
  it("expands a single syllable target to the whole word", () => {
    seedSingleLine({
      id: "L1",
      text: "fu|cking yeah",
      agentId: "v1",
      words: [
        { id: "w40", text: "fu", sep: "", begin: 0, end: 0.2 },
        { id: "w41", text: "cking", sep: " ", begin: 0.2, end: 0.5 },
        { id: "w42", text: "yeah", sep: "", begin: 0.5, end: 1 },
      ],
    });
    useProjectStore.getState().commit(markWordsExplicit([{ lineId: "L1", field: "words", wordIndex: 0 }], true));
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[0].explicit).toBe(true);
    expect(words[1].explicit).toBe(true);
    expect(words[2].explicit).toBeUndefined();
  });

  it("preserves a previously-set explicit flag on another word when batch-marking across linked siblings", () => {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "A",
          text: "fuck this shit",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w43", text: "fuck", sep: " ", begin: 0, end: 0.3 },
            { id: "w44", text: "this", sep: " ", begin: 0.3, end: 0.6 },
            { id: "w45", text: "shit", sep: "", begin: 0.6, end: 1, explicit: true },
          ],
        },
        {
          id: "B",
          text: "fuck this shit",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w46", text: "fuck", sep: " ", begin: 30, end: 30.3 },
            { id: "w47", text: "this", sep: " ", begin: 30.3, end: 30.6 },
            { id: "w48", text: "shit", sep: "", begin: 30.6, end: 31, explicit: true },
          ],
        },
      ],
    });
    useProjectStore.getState().commit(
      markWordsExplicit(
        [
          { lineId: "A", field: "words", wordIndex: 0 },
          { lineId: "B", field: "words", wordIndex: 0 },
        ],
        true,
      ),
    );
    const lines = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(lines[0]))[0].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[0]))[2].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[1]))[0].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[1]))[2].explicit).toBe(true);
  });
});

describe("toggleWordExplicit · background provenance", () => {
  function seedExtractionBgLine() {
    seedSingleLine({
      id: "L1",
      text: "main",
      agentId: "v1",
      words: [{ id: "w49", text: "main", sep: "", begin: 0, end: 1 }],
      backgroundText: "oh shit",
      backgroundTextSource: "extraction",
      backgroundWords: [
        { id: "w50", text: "oh", sep: " ", begin: 1, end: 1.25 },
        { id: "w51", text: "shit", sep: "", begin: 1.25, end: 1.5 },
      ],
    });
  }

  it("flips backgroundTextSource to manual after a background-word edit", () => {
    seedExtractionBgLine();
    useProjectStore.getState().commit(toggleWordExplicit("L1", "backgroundWords", [1]));
    const line = useProjectStore.getState().lines[0];
    expect(backgroundTrack(line)?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(line))[1].explicit).toBe(true);
    expect(timedSyllables(backgroundTrack(line))[0].explicit).toBeUndefined();
    expect(backgroundText(line)).toBe("oh shit");
  });

  it("leaves backgroundTextSource untouched when editing the main words field", () => {
    seedExtractionBgLine();
    useProjectStore.getState().commit(toggleWordExplicit("L1", "words", [0]));
    const line = useProjectStore.getState().lines[0];
    expect(backgroundTrack(line)?.source).toBe("extraction");
    expect(timedSyllables(mainTrack(line))[0].explicit).toBe(true);
  });

  it("flips linked siblings to manual when a background-word edit propagates", () => {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "A",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w52", text: "main", sep: "", begin: 0, end: 1 }],
          backgroundText: "oh shit",
          backgroundTextSource: "extraction",
          backgroundWords: [
            { id: "w53", text: "oh", sep: " ", begin: 1, end: 1.25 },
            { id: "w54", text: "shit", sep: "", begin: 1.25, end: 1.5 },
          ],
        },
        {
          id: "B",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [{ id: "w55", text: "main", sep: "", begin: 30, end: 31 }],
          backgroundText: "oh shit",
          backgroundTextSource: "extraction",
          backgroundWords: [
            { id: "w56", text: "oh", sep: " ", begin: 31, end: 31.25 },
            { id: "w57", text: "shit", sep: "", begin: 31.25, end: 31.5 },
          ],
        },
      ],
    });
    useProjectStore.getState().commit(toggleWordExplicit("A", "backgroundWords", [1]));
    const lines = useProjectStore.getState().lines;
    expect(backgroundTrack(lines[0])?.source).toBe("manual");
    expect(backgroundTrack(lines[1])?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(lines[0]))[1].explicit).toBe(true);
    expect(timedSyllables(backgroundTrack(lines[1]))[1].explicit).toBe(true);
    expect(timedSyllables(backgroundTrack(lines[1]))[1].begin).toBeCloseTo(31.25);
  });

  it("undo restores the prior extraction provenance", () => {
    seedExtractionBgLine();
    useProjectStore.getState().commit(toggleWordExplicit("L1", "backgroundWords", [1]));
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("manual");
    useProjectStore.getState().undo();
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("extraction");
  });
});

describe("markWordsExplicit · background provenance", () => {
  it("flips backgroundTextSource to manual after a background-word edit", () => {
    seedSingleLine({
      id: "L1",
      text: "main",
      agentId: "v1",
      words: [{ id: "w58", text: "main", sep: "", begin: 0, end: 1 }],
      backgroundText: "oh shit",
      backgroundTextSource: "extraction",
      backgroundWords: [
        { id: "w59", text: "oh", sep: " ", begin: 1, end: 1.25 },
        { id: "w60", text: "shit", sep: "", begin: 1.25, end: 1.5 },
      ],
    });
    useProjectStore
      .getState()
      .commit(markWordsExplicit([{ lineId: "L1", field: "backgroundWords", wordIndex: 0 }], true));
    const line = useProjectStore.getState().lines[0];
    expect(backgroundTrack(line)?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(line))[0].explicit).toBe(true);
    expect(backgroundText(line)).toBe("oh shit");
  });

  it("leaves backgroundTextSource untouched when marking the main words field", () => {
    seedSingleLine({
      id: "L1",
      text: "main",
      agentId: "v1",
      words: [{ id: "w61", text: "main", sep: "", begin: 0, end: 1 }],
      backgroundText: "oh shit",
      backgroundTextSource: "extraction",
      backgroundWords: [
        { id: "w62", text: "oh", sep: " ", begin: 1, end: 1.25 },
        { id: "w63", text: "shit", sep: "", begin: 1.25, end: 1.5 },
      ],
    });
    useProjectStore.getState().commit(markWordsExplicit([{ lineId: "L1", field: "words", wordIndex: 0 }], true));
    const line = useProjectStore.getState().lines[0];
    expect(backgroundTrack(line)?.source).toBe("extraction");
    expect(timedSyllables(mainTrack(line))[0].explicit).toBe(true);
  });

  it("flips linked siblings to manual when a background-word edit propagates", () => {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "A",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [{ id: "w64", text: "main", sep: "", begin: 0, end: 1 }],
          backgroundText: "oh shit",
          backgroundTextSource: "extraction",
          backgroundWords: [
            { id: "w65", text: "oh", sep: " ", begin: 1, end: 1.25 },
            { id: "w66", text: "shit", sep: "", begin: 1.25, end: 1.5 },
          ],
        },
        {
          id: "B",
          text: "main",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [{ id: "w67", text: "main", sep: "", begin: 30, end: 31 }],
          backgroundText: "oh shit",
          backgroundTextSource: "extraction",
          backgroundWords: [
            { id: "w68", text: "oh", sep: " ", begin: 31, end: 31.25 },
            { id: "w69", text: "shit", sep: "", begin: 31.25, end: 31.5 },
          ],
        },
      ],
    });
    useProjectStore
      .getState()
      .commit(markWordsExplicit([{ lineId: "A", field: "backgroundWords", wordIndex: 0 }], true));
    const lines = useProjectStore.getState().lines;
    expect(backgroundTrack(lines[0])?.source).toBe("manual");
    expect(backgroundTrack(lines[1])?.source).toBe("manual");
    expect(timedSyllables(backgroundTrack(lines[0]))[0].explicit).toBe(true);
    expect(timedSyllables(backgroundTrack(lines[1]))[0].explicit).toBe(true);
  });
});

describe("markWordsExplicit · batch action", () => {
  it("applies multiple targets in a single history entry so one undo reverts them all", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "L1",
          text: "fuck this",
          agentId: "v1",
          words: [
            { id: "w70", text: "fuck", sep: " ", begin: 0, end: 0.5 },
            { id: "w71", text: "this", sep: "", begin: 0.5, end: 1 },
          ],
        },
        {
          id: "L2",
          text: "shit happens",
          agentId: "v1",
          words: [
            { id: "w72", text: "shit", sep: " ", begin: 1, end: 1.5 },
            { id: "w73", text: "happens", sep: "", begin: 1.5, end: 2 },
          ],
        },
        {
          id: "L3",
          text: "damn cool",
          agentId: "v1",
          words: [
            { id: "w74", text: "damn", sep: " ", begin: 2, end: 2.5 },
            { id: "w75", text: "cool", sep: "", begin: 2.5, end: 3 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(
      markWordsExplicit(
        [
          { lineId: "L1", field: "words", wordIndex: 0 },
          { lineId: "L2", field: "words", wordIndex: 0 },
          { lineId: "L3", field: "words", wordIndex: 0 },
        ],
        true,
      ),
    );

    const after = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(after[0]))[0].explicit).toBe(true);
    expect(timedSyllables(mainTrack(after[1]))[0].explicit).toBe(true);
    expect(timedSyllables(mainTrack(after[2]))[0].explicit).toBe(true);

    useProjectStore.getState().undo();
    const undone = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(undone[0]))[0].explicit).toBeUndefined();
    expect(timedSyllables(mainTrack(undone[1]))[0].explicit).toBeUndefined();
    expect(timedSyllables(mainTrack(undone[2]))[0].explicit).toBeUndefined();
  });

  it("propagates to linked siblings for each target", () => {
    const group: LinkGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
    useProjectStore.getState().restoreLyrics({ groups: [group] });
    useProjectStore.getState().restoreLyrics({
      lines: [
        {
          id: "A",
          text: "I fuck you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
          words: [
            { id: "w76", text: "I", sep: " ", begin: 0, end: 0.3 },
            { id: "w77", text: "fuck", sep: " ", begin: 0.3, end: 0.6 },
            { id: "w78", text: "you", sep: "", begin: 0.6, end: 1 },
          ],
        },
        {
          id: "B",
          text: "I fuck you",
          agentId: "v1",
          groupId: "g1",
          instanceIdx: 1,
          templateLineIdx: 0,
          words: [
            { id: "w79", text: "I", sep: " ", begin: 30, end: 30.4 },
            { id: "w80", text: "fuck", sep: " ", begin: 30.4, end: 30.7 },
            { id: "w81", text: "you", sep: "", begin: 30.7, end: 31.2 },
          ],
        },
      ],
    });

    useProjectStore.getState().commit(markWordsExplicit([{ lineId: "A", field: "words", wordIndex: 1 }], true));
    const lines = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(lines[0]))[1].explicit).toBe(true);
    expect(timedSyllables(mainTrack(lines[1]))[1].explicit).toBe(true);
  });

  it("is a no-op when targets is empty", () => {
    seedSingleLine({
      id: "L1",
      text: "fuck",
      agentId: "v1",
      words: [{ id: "w82", text: "fuck", sep: "", begin: 0, end: 1 }],
    });
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().commit(markWordsExplicit([], true));
    expect(useProjectStore.getState().lines).toBe(before);
  });

  it("can clear flags when value=false", () => {
    seedSingleLine({
      id: "L1",
      text: "fuck this",
      agentId: "v1",
      words: [
        { id: "w83", text: "fuck", sep: " ", begin: 0, end: 0.5, explicit: true },
        { id: "w84", text: "this", sep: "", begin: 0.5, end: 1, explicit: true },
      ],
    });
    useProjectStore.getState().commit(
      markWordsExplicit(
        [
          { lineId: "L1", field: "words", wordIndex: 0 },
          { lineId: "L1", field: "words", wordIndex: 1 },
        ],
        false,
      ),
    );
    const words = timedSyllables(mainTrack(useProjectStore.getState().lines[0]));
    expect(words[0].explicit).toBeUndefined();
    expect(words[1].explicit).toBeUndefined();
  });
});
