/**
 * @vitest-environment node
 */
import { withSeededBackground } from "insync/line-background";
import { drawnSyllables } from "insync/line-drawn-track";
import { mainBounds } from "insync/line-bounds";
import { isLineSynced } from "insync/line-predicates";
import { backgroundText, lineText } from "insync/line-text";
import { backgroundTrack, mainTrack, roleWords, untimedSyllable } from "insync/line-track";
import { withMainTrack, withTrackSyllables } from "insync/line-track-writes";
import { deleteWords, insertWord, splitWord, typeWordText } from "insync/commands/word-structure";
import { splitWordIntoSyllables } from "insync/single-word-syllable-split";
import { syncClosingTap, syncGesture } from "insync/commands/sync";
import { withAlignedTransliteration } from "insync/language-align";
import { pasteLyrics } from "insync/commands/edit-text";
import { trackPieces } from "insync/language-pieces";
import { addressOf } from "insync/selection-resolve";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

const tide = createWord({ text: "tide ", begin: 4, end: 4.5 });
const tideAddress = addressOf({ id: "l1" }, "word", tide);

beforeEach(() => {
  useProjectStore.getState().reset();
  const words = [tide, createWord({ text: "turns", begin: 4.6, end: 5.2 })];
  useProjectStore
    .getState()
    .commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "l1", text: "tide turns", words })]));
});

describe("word structure commands", () => {
  it("refuses to type into a word deleted since the editor opened", () => {
    useProjectStore.getState().commit(deleteWords([tideAddress]));
    const before = useProjectStore.getState().history;
    const outcome = useProjectStore.getState().commit(typeWordText(tideAddress, "moon"));
    expect(outcome).toEqual({ refused: { reason: "word-gone", address: tideAddress } });
    expect(useProjectStore.getState().history).toBe(before);
  });

  it("drops the reading of a deleted word with it", () => {
    const [line] = useProjectStore.getState().lines;
    const [, turns] = roleWords(line, "main") ?? [];
    const pieces = { [tide.id]: { text: "taido" }, [turns.id]: { text: "taanzu" } };
    const main = { text: "taido taanzu", pieces };
    useProjectStore.setState({
      lines: [
        {
          ...line,
          languages: { transliteration: { language: "ja-Latn", origin: "manual", sourceFingerprint: "", main } },
        },
      ],
    });
    useProjectStore.getState().commit(deleteWords([tideAddress]));
    expect(Object.keys(trackPieces(useProjectStore.getState().lines[0], "main") ?? {})).toEqual([turns.id]);
  });

  it("regression: the romanization text drops the reading of a deleted word", () => {
    const [line] = useProjectStore.getState().lines;
    const [, turns] = roleWords(line, "main") ?? [];
    const pieces = { [tide.id]: { text: "taido" }, [turns.id]: { text: "taanzu" } };
    const main = { text: "taido taanzu", pieces };
    const transliteration = { language: "ja-Latn", origin: "manual" as const, sourceFingerprint: "", main };
    useProjectStore.setState({ lines: [{ ...line, languages: { transliteration } }] });
    useProjectStore.getState().commit(deleteWords([tideAddress]));
    expect(useProjectStore.getState().lines[0].languages?.transliteration?.main.text).toBe("taanzu");
  });

  it("regression: a romanization missing a reading for a new word keeps its text and needs review", () => {
    const [line] = useProjectStore.getState().lines;
    const [, turns] = roleWords(line, "main") ?? [];
    const pieces = { [tide.id]: { text: "taido" }, [turns.id]: { text: "taanzu" } };
    const main = { text: "taido taanzu", pieces, alignmentStatus: "confirmed" as const };
    const transliteration = { language: "ja-Latn", origin: "manual" as const, sourceFingerprint: "", main };
    useProjectStore.setState({ lines: [{ ...line, languages: { transliteration } }] });
    useProjectStore.getState().commit(insertWord("l1", "word", createWord({ text: "high", begin: 6, end: 7 })));
    expect(useProjectStore.getState().lines[0].languages?.transliteration?.main).toMatchObject({
      text: "taido taanzu",
      alignmentStatus: "needs-review",
    });
  });

  it("regression: a space or split mark typed into a word becomes a boundary, as Edit reads it", () => {
    useProjectStore.getState().commit(typeWordText(tideAddress, "ti|de and"));
    const syllables = mainTrack(useProjectStore.getState().lines[0]).syllables;
    expect(syllables.map(({ text, sep, joinsNext }) => [text, sep, joinsNext])).toEqual([
      ["ti", "", true],
      ["de", " ", false],
      ["and", " ", false],
      ["turns", "", false],
    ]);
  });

  it("regression: a space typed at the end of a word counts once", () => {
    useProjectStore.getState().commit(typeWordText(tideAddress, "tide "));
    expect(lineText(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER)).toBe("tide turns");
  });

  it("regression: a split inside a block of several words leaves no space inside a syllable", () => {
    useProjectStore
      .getState()
      .commit(
        pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "l2", text: "sea glass", begin: 3, end: 5 })]),
      );
    const [block] = drawnSyllables(useProjectStore.getState().lines[0], "main", DEFAULT_SPLIT_CHARACTER);
    const pieces = splitWordIntoSyllables({ word: block, splitPoints: [5] });
    useProjectStore.getState().commit(splitWord("l2", "words", pieces, {}));
    const syllables = mainTrack(useProjectStore.getState().lines[0]).syllables;
    expect(syllables.map(({ text, sep, joinsNext }) => [text, sep, joinsNext])).toEqual([
      ["sea", " ", false],
      ["g", "", true],
      ["lass", "", false],
    ]);
  });

  it("regression: splitting a syllable that overlaps the next one keeps the syllables in time order", () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l3",
          text: "tornu totr",
          words: [
            { text: "tornu", sep: " ", begin: 1, end: 3 },
            { text: "totr", begin: 1.5, end: 2 },
          ],
        }),
      ],
    });
    const [tornu, totr] = roleWords(useProjectStore.getState().lines[0], "main") ?? [];
    const pieces = splitWordIntoSyllables({ word: tornu, splitPoints: [3] });
    useProjectStore.getState().commit(splitWord("l3", "words", [...pieces, totr], {}));
    const begins = (roleWords(useProjectStore.getState().lines[0], "main") ?? []).map((word) => word.begin);
    expect(begins).toEqual(begins.toSorted((a, b) => a - b));
  });

  it("regression: a three-part split of a syllable overlapping the next one leaves no part without length", () => {
    useProjectStore.setState({
      lines: [
        createLine({
          id: "l4",
          text: "tanuda totr",
          words: [
            { text: "tanuda", sep: " ", begin: 1, end: 4 },
            { text: "totr", begin: 1.5, end: 2 },
          ],
        }),
      ],
    });
    const [tanuda, totr] = roleWords(useProjectStore.getState().lines[0], "main") ?? [];
    const pieces = splitWordIntoSyllables({ word: tanuda, splitPoints: [2, 4] });
    useProjectStore.getState().commit(splitWord("l4", "words", [...pieces, totr], {}));
    const words = roleWords(useProjectStore.getState().lines[0], "main") ?? [];
    const begins = words.map((word) => word.begin);
    expect(begins).toEqual(begins.toSorted((a, b) => a - b));
    for (const word of words.slice(0, 3))
      expect(Math.round(word.end * 1000) - Math.round(word.begin * 1000)).toBeGreaterThan(0);
  });

  it("regression: renaming the block of a line-synced row updates text and keeps it line-synced", () => {
    useProjectStore
      .getState()
      .commit(pasteLyrics(useProjectStore.getState().lines, [createLine({ id: "l2", text: "Old", begin: 3, end: 5 })]));
    const [block] = drawnSyllables(useProjectStore.getState().lines[0], "main", DEFAULT_SPLIT_CHARACTER);
    useProjectStore.getState().commit(typeWordText(addressOf({ id: "l2" }, "word", block), "New words"));
    const [line] = useProjectStore.getState().lines;
    expect(lineText(line, DEFAULT_SPLIT_CHARACTER)).toBe("New words");
    expect(isLineSynced(line)).toBe(true);
    expect(mainBounds(line)).toEqual({ begin: 3, end: 5 });
  });

  it("regression: renaming the block of a line-synced background updates its text and keeps the span", () => {
    const line = withSeededBackground(
      createLine({ id: "l3", text: "Low", begin: 2, end: 6, backgroundText: "far away" }),
      DEFAULT_SPLIT_CHARACTER,
    );
    useProjectStore.setState({ lines: [line] });
    const [block] = drawnSyllables(line, "bg", DEFAULT_SPLIT_CHARACTER);
    useProjectStore.getState().commit(typeWordText(addressOf(line, "bg", block), "so near"));
    const [renamed] = useProjectStore.getState().lines;
    expect(backgroundText(renamed, DEFAULT_SPLIT_CHARACTER)).toBe("so near");
    expect(backgroundTrack(renamed)).toMatchObject({ begin: 4, end: 6, source: "manual" });
  });

  it("regression: deleting the block of a line-synced background deletes it, as deleting all its words does", () => {
    const line = withSeededBackground(
      createLine({ id: "l4", text: "Low", begin: 2, end: 6, backgroundText: "far away" }),
      DEFAULT_SPLIT_CHARACTER,
    );
    useProjectStore.setState({ lines: [line] });
    const [block] = drawnSyllables(line, "bg", DEFAULT_SPLIT_CHARACTER);
    useProjectStore.getState().commit(deleteWords([addressOf(line, "bg", block)]));
    expect(backgroundTrack(useProjectStore.getState().lines[0])).toBeUndefined();
  });
});

describe("romanization through Sync", () => {
  it("regression: a romanization with no readings still infers them once every syllable is synced", () => {
    const main = { text: "HO NO KO" };
    const transliteration = { language: "ja-Latn", origin: "google" as const, sourceFingerprint: "", main };
    const line = { ...createLine({ id: "l5", text: "ほ の こ" }), languages: { transliteration } };
    useProjectStore.setState({ lines: [line] });
    for (let wordIndex = 0; wordIndex < 3; wordIndex++) {
      const cursor = { lineIndex: 0, wordIndex };
      const ctx = { cursor, jumped: false, time: 1 + wordIndex, defaultWordDuration: 0.5 };
      useProjectStore.getState().commit(syncGesture("tap-word", ctx, () => {}));
    }
    const synced = withAlignedTransliteration(useProjectStore.getState().lines[0], DEFAULT_SPLIT_CHARACTER);
    const pieces = trackPieces(synced, "main");
    expect(roleWords(synced, "main")?.map((word) => pieces?.[word.id]?.text)).toEqual(["HO", "NO", "KO"]);
  });

  it("regression: a partly synced line keeps the reading of its untimed rest when a timed word goes", () => {
    const { line, timed } = partlySyncedStar("l6");
    useProjectStore.getState().commit(deleteWords([addressOf(line, "word", timed[1])]));
    expect(useProjectStore.getState().lines[0].languages?.transliteration?.main.text).toBe("hoshi koe yo");
  });

  it("regression: a word that loses its timing keeps its reading, and syncing it again keeps the text settled", () => {
    const { line, timed } = partlySyncedStar("l7");
    const steppedBack = mainTrack(line).syllables.map((syllable) =>
      syllable.id === timed[2].id ? untimedSyllable(syllable) : syllable,
    );
    const tracks = withMainTrack(line, withTrackSyllables(mainTrack(line), steppedBack)).tracks;
    useProjectStore.getState().commit(syncClosingTap([{ id: line.id, updates: { tracks } }]));
    expect(useProjectStore.getState().lines[0].languages?.transliteration?.main.text).toBe("hoshi no koe yo");

    const ctx = { cursor: { lineIndex: 0, wordIndex: 2 }, jumped: false, time: 3, defaultWordDuration: 0.5 };
    useProjectStore.getState().commit(syncGesture("tap-word", ctx, () => {}));
    const resynced = useProjectStore.getState().lines[0].languages?.transliteration?.main;
    expect(resynced).toMatchObject({ text: "hoshi no koe yo" });
    expect(resynced?.alignmentStatus).not.toBe("needs-review");
  });
});

function partlySyncedStar(id: string) {
  const timed = [
    createWord({ text: "ほし ", begin: 1, end: 2 }),
    createWord({ text: "の ", begin: 2, end: 3 }),
    createWord({ text: "こえ ", begin: 3, end: 4 }),
  ];
  const readings = ["hoshi", "no", "koe"];
  const pieces = Object.fromEntries(timed.map((word, index) => [word.id, { text: readings[index], joinerAfter: " " }]));
  const main = { text: "hoshi no koe yo", pieces };
  const transliteration = { language: "ja-Latn", origin: "manual" as const, sourceFingerprint: "", main };
  const line = { ...createLine({ id, text: "ほし の こえ よ", words: timed }), languages: { transliteration } };
  useProjectStore.setState({ lines: [line] });
  return { line, timed };
}
