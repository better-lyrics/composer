/**
 * @vitest-environment node
 */
import { pasteLyrics } from "@/domain/commands/edit-text";
import { duplicateWords, moveWordsAcrossLines } from "@/domain/commands/word-moves";
import { pieceOf, trackPieces } from "@/domain/language/pieces";
import type { LineLanguages } from "@/domain/language/model";
import type { WordTrack } from "@/domain/line/tracks";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

const drift = createWord({ text: "drift", begin: 2, end: 2.5 });

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore
    .getState()
    .commit(
      pasteLyrics(useProjectStore.getState().lines, [
        createLine({ id: "a", text: "drift", words: [drift] }),
        createLine({ id: "b", text: "harbour", words: [createWord({ text: "harbour", begin: 2.1, end: 3 })] }),
      ]),
    );
});

describe("word move commands", () => {
  it("refuses a move onto a taken spot and leaves the lines alone", () => {
    const before = useProjectStore.getState().lines;
    const outcome = useProjectStore.getState().commit(
      moveWordsAcrossLines({
        addresses: [addressOf({ id: "a" }, "word", drift)],
        fromLineId: "a",
        targetLineId: "b",
        targetTrack: "word",
        timeDelta: 0,
        duration: 60,
      }),
    );
    expect(outcome).toEqual({ refused: { reason: "move", reject: "overlap" } });
    expect(useProjectStore.getState().lines).toBe(before);
  });

  it.each<[string, string, WordTrack]>([
    ["onto another line", "b", "word"],
    ["onto the background of its own line", "a", "bg"],
  ])("carries a moved word's reading %s", (_, targetLineId, targetTrack) => {
    const reading = (main: string, pieces = {}): LineLanguages => ({
      transliteration: {
        language: "ja-Latn",
        origin: "manual",
        sourceFingerprint: "",
        main: { text: main, pieces },
        bg: { text: "" },
      },
    });
    const [a, b] = useProjectStore.getState().lines;
    useProjectStore.setState({
      lines: [
        { ...a, languages: reading("dorifuto", { [drift.id]: { text: "dorifuto" } }) },
        { ...b, languages: reading("haabaa") },
      ],
    });
    useProjectStore.getState().commit(
      moveWordsAcrossLines({
        addresses: [addressOf({ id: "a" }, "word", drift)],
        fromLineId: "a",
        targetLineId,
        targetTrack,
        timeDelta: 2,
        duration: 60,
      }),
    );
    const lines = useProjectStore.getState().lines;
    const target = lines.find((line) => line.id === targetLineId);
    const side = targetTrack === "word" ? "main" : "bg";
    expect(target && pieceOf(trackPieces(target, side), drift)).toEqual({ text: "dorifuto" });
    expect(lines.find((line) => line.id === "a")?.languages?.transliteration?.main.pieces).toBeUndefined();
  });

  it("gives a duplicated word the reading of the word it copies", () => {
    const [a, b] = useProjectStore.getState().lines;
    const main = { text: "dorifuto", pieces: { [drift.id]: { text: "dorifuto" } } };
    const transliteration = { language: "ja-Latn", origin: "manual" as const, sourceFingerprint: "", main };
    useProjectStore.setState({ lines: [{ ...a, languages: { transliteration } }, b] });
    useProjectStore
      .getState()
      .commit(duplicateWords({ addresses: [addressOf({ id: "a" }, "word", drift)], timeDelta: 2, duration: 60 }));
    const [line] = useProjectStore.getState().lines;
    expect(line.words?.map((word) => pieceOf(trackPieces(line, "main"), word))).toEqual([
      { text: "dorifuto" },
      { text: "dorifuto" },
    ]);
  });
});
