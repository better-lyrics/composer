import { beforeEach, describe, expect, it } from "vitest";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { splitIdenticalSyllables } from "@/domain/commands/word-edits";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";

describe("project.splitSyllablesAcrossIdenticalWordsWithHistory", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it("splits source and matches in a single undo step", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "running", begin: 2, end: 3 }] }),
    ];
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, lines));

    useProjectStore.getState().commit(
      splitIdenticalSyllables({
        source: { lineId: "l1", wordIndex: 0, type: "word" },
        splitPoints: [3],
        caseInsensitive: false,
      }),
    );

    const after = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(after[0]))).toHaveLength(2);
    expect(timedSyllables(mainTrack(after[1]))).toHaveLength(2);

    useProjectStore.getState().undo();
    const reverted = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(reverted[0]))).toHaveLength(1);
    expect(timedSyllables(mainTrack(reverted[1]))).toHaveLength(1);
  });

  it("source word splits even when there are no other matches", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "alone", begin: 0, end: 1 }] })];
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, lines));

    useProjectStore.getState().commit(
      splitIdenticalSyllables({
        source: { lineId: "l1", wordIndex: 0, type: "word" },
        splitPoints: [2],
        caseInsensitive: false,
      }),
    );

    expect(timedSyllables(mainTrack(useProjectStore.getState().lines[0]))).toHaveLength(2);
  });

  it("case-insensitive flag splits Capitalized siblings via the action", () => {
    const lines = [
      createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] }),
      createLine({ id: "l2", words: [{ text: "Running", begin: 2, end: 3 }] }),
    ];
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, lines));
    useProjectStore.getState().commit(
      splitIdenticalSyllables({
        source: { lineId: "l1", wordIndex: 0, type: "word" },
        splitPoints: [3],
        caseInsensitive: true,
      }),
    );
    const after = useProjectStore.getState().lines;
    expect(timedSyllables(mainTrack(after[1]))).toHaveLength(2);
    expect(timedSyllables(mainTrack(after[1]))[0].text).toBe("Run");
  });

  it("is a no-op when splitPoints is empty", () => {
    const lines = [createLine({ id: "l1", words: [{ text: "running", begin: 0, end: 1 }] })];
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, lines));
    const before = useProjectStore.getState().lines;
    useProjectStore.getState().commit(
      splitIdenticalSyllables({
        source: { lineId: "l1", wordIndex: 0, type: "word" },
        splitPoints: [],
        caseInsensitive: false,
      }),
    );
    expect(useProjectStore.getState().lines).toBe(before);
  });
});

describe("project.splitSyllablesAcrossIdenticalWordsWithHistory · background provenance", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it("flips backgroundTextSource to manual after splitting a background word", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundText: "running",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "running", begin: 1, end: 2 }],
      }),
    ];
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, lines));
    useProjectStore.getState().commit(
      splitIdenticalSyllables({
        source: { lineId: "l1", wordIndex: 0, type: "bg" },
        splitPoints: [3],
        caseInsensitive: false,
      }),
    );
    const line = useProjectStore.getState().lines[0];
    expect(timedSyllables(backgroundTrack(line))).toHaveLength(2);
    expect(backgroundTrack(line)?.source).toBe("manual");
  });

  it("leaves backgroundTextSource untouched when only the main track is split", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "running", begin: 0, end: 1 }],
        backgroundText: "ooh",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "ooh", begin: 1, end: 2 }],
      }),
    ];
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, lines));
    useProjectStore.getState().commit(
      splitIdenticalSyllables({
        source: { lineId: "l1", wordIndex: 0, type: "word" },
        splitPoints: [3],
        caseInsensitive: false,
      }),
    );
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("extraction");
  });

  it("undo restores the prior extraction provenance", () => {
    const lines = [
      createLine({
        id: "l1",
        words: [{ text: "main", begin: 0, end: 1 }],
        backgroundText: "running",
        backgroundTextSource: "extraction",
        backgroundWords: [{ text: "running", begin: 1, end: 2 }],
      }),
    ];
    useProjectStore.getState().commit(pasteLyrics(useProjectStore.getState().lines, lines));
    useProjectStore.getState().commit(
      splitIdenticalSyllables({
        source: { lineId: "l1", wordIndex: 0, type: "bg" },
        splitPoints: [3],
        caseInsensitive: false,
      }),
    );
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("manual");
    useProjectStore.getState().undo();
    expect(backgroundTrack(useProjectStore.getState().lines[0])?.source).toBe("extraction");
  });
});
