/**
 * @vitest-environment node
 */
import { withSeededBackground } from "@/domain/line/background";
import { drawnSyllables } from "@/domain/line/drawn-track";
import { mainBounds } from "insync/line-bounds";
import { isLineSynced } from "@/domain/line/predicates";
import { backgroundText, lineText } from "@/domain/line/text";
import { backgroundTrack, roleWords } from "insync/line-track";
import { deleteWords, typeWordText } from "@/domain/commands/word-structure";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { trackPieces } from "@/domain/language/pieces";
import { addressOf } from "@/domain/selection/resolve";
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
