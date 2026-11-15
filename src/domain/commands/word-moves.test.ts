/**
 * @vitest-environment node
 */

import { pasteLyrics } from "@/domain/commands/edit-text";
import { duplicateWords, moveWordsAcrossLines } from "@/domain/commands/word-moves";
import { pieceOf, trackPieces } from "insync/language-pieces";
import type { LineLanguages } from "insync/language";
import { roleWords, type WordTrack } from "insync/line-track";
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
    expect(roleWords(line, "main")?.map((word) => pieceOf(trackPieces(line, "main"), word))).toEqual([
      { text: "dorifuto" },
      { text: "dorifuto" },
    ]);
  });

  it("carries a reading held without a romanization onto another line", () => {
    const [a, b] = useProjectStore.getState().lines;
    useProjectStore.setState({
      lines: [{ ...a, languages: { heldReadings: { main: { [drift.id]: { text: "dorifuto" } } } } }, b],
    });
    useProjectStore.getState().commit(
      moveWordsAcrossLines({
        addresses: [addressOf({ id: "a" }, "word", drift)],
        fromLineId: "a",
        targetLineId: "b",
        targetTrack: "word",
        timeDelta: 2,
        duration: 60,
      }),
    );
    const [movedFrom, movedTo] = useProjectStore.getState().lines;
    expect(pieceOf(trackPieces(movedTo, "main"), drift)).toEqual({ text: "dorifuto" });
    expect(movedFrom.languages).toBeUndefined();
  });
});

describe("word moves inside a group instance", () => {
  const chorusGroup = { id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 };
  const chorusLines = (instanceIdx: number, begin: number) => [
    createLine({
      id: `top-${instanceIdx}`,
      text: "We glow tonight",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 0,
      words: [
        { text: "We", sep: " ", begin, end: begin + 0.4 },
        { text: "glow", sep: " ", begin: begin + 0.4, end: begin + 0.9 },
        { text: "tonight", begin: begin + 0.9, end: begin + 1.5 },
      ],
    }),
    createLine({
      id: `bottom-${instanceIdx}`,
      text: "and burn",
      groupId: "g1",
      instanceIdx,
      templateLineIdx: 1,
      words: [
        { text: "and", sep: " ", begin: begin + 2, end: begin + 2.4 },
        { text: "burn", begin: begin + 2.4, end: begin + 3 },
      ],
    }),
  ];

  it("regression: a word moved between lines of one instance moves in every instance", () => {
    useProjectStore.getState().restoreLyrics({
      lines: [...chorusLines(0, 10), ...chorusLines(1, 40), ...chorusLines(2, 70)],
      groups: [chorusGroup],
    });
    const top = useProjectStore.getState().lines.find((line) => line.id === "top-1");
    const tonight = top && roleWords(top, "main")?.[2];
    if (!tonight) throw new Error("expected tonight in instance 2");

    useProjectStore.getState().commit(
      moveWordsAcrossLines({
        addresses: [addressOf({ id: "top-1" }, "word", tonight)],
        fromLineId: "top-1",
        targetLineId: "bottom-1",
        targetTrack: "word",
        timeDelta: 0.5,
        duration: 120,
      }),
    );

    for (const instanceIdx of [0, 1, 2]) {
      const bottom = useProjectStore.getState().lines.find((line) => line.id === `bottom-${instanceIdx}`);
      expect(roleWords(bottom, "main")?.[0].text).toBe("tonight");
      const topLine = useProjectStore.getState().lines.find((line) => line.id === `top-${instanceIdx}`);
      expect(roleWords(topLine, "main")?.map((word) => word.text)).toEqual(["We", "glow"]);
    }
  });
});
