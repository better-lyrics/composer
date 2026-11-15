/**
 * @vitest-environment node
 */
import { withSeededBackground } from "insync/line-background";
import { drawnSyllables } from "insync/line-drawn-track";
import { mainBounds } from "insync/line-bounds";
import { isLineSynced } from "insync/line-predicates";
import { backgroundText, lineText } from "insync/line-text";
import { backgroundTrack, roleWords } from "insync/line-track";
import { deleteWords, insertWord, typeWordText } from "insync/commands/word-structure";
import { syncGesture } from "insync/commands/sync";
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
    const timed = [
      createWord({ text: "ほし ", begin: 1, end: 2 }),
      createWord({ text: "の ", begin: 2, end: 3 }),
      createWord({ text: "こえ ", begin: 3, end: 4 }),
    ];
    const readings = ["hoshi", "no", "koe"];
    const pieces = Object.fromEntries(
      timed.map((word, index) => [word.id, { text: readings[index], joinerAfter: " " }]),
    );
    const main = { text: "hoshi no koe yo", pieces };
    const transliteration = { language: "ja-Latn", origin: "manual" as const, sourceFingerprint: "", main };
    const line = { ...createLine({ id: "l6", text: "ほし の こえ よ", words: timed }), languages: { transliteration } };
    useProjectStore.setState({ lines: [line] });
    useProjectStore.getState().commit(deleteWords([addressOf(line, "word", timed[1])]));
    expect(useProjectStore.getState().lines[0].languages?.transliteration?.main.text).toBe("hoshi koe yo");
  });
});
