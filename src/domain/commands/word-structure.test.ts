/**
 * @vitest-environment node
 */
import { roleWords } from "@/domain/line/track";
import { deleteWords, typeWordText } from "@/domain/commands/word-structure";
import { pasteLyrics } from "@/domain/commands/edit-text";
import { trackPieces } from "@/domain/language/pieces";
import { addressOf } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { createLine, createWord } from "@/test/factories";
import { beforeEach, describe, expect, it } from "vitest";

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
});
